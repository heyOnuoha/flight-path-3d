import { NextResponse } from "next/server";
import { getAirport } from "@/lib/airports";
import { rateLimit, clientKey } from "@/lib/rate-limit";

// Per-client request ceilings (defense-in-depth on top of the shared Data
// Cache). Search queries are cache-busting and thus the real quota risk, so
// they get a tighter budget than the cached default feed.
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_FEED_LIMIT_PER_MIN = 60; // generous: client polls every 120s
const SEARCH_LIMIT_PER_MIN = 20; // each distinct query can cost an upstream call

// Server-side revalidation windows. The default feed is refreshed aggressively
// so the map feels real-time; search-specific queries refresh more slowly.
const DEFAULT_FEED_REVALIDATE_S = 120;
const SEARCH_QUERY_REVALIDATE_S = 600;

// Default-feed pagination. Aviationstack returns most "active" flights without
// a `live` block, so we have to fetch a large pool and keep only the trackable
// ones. PAGES × PAGE_SIZE = upper bound on flights pulled per refresh cycle.
const FEED_PAGE_SIZE = 1000;
const FEED_MAX_PAGES = 3;

// Quota cost: 3 calls per default-feed refresh × (3600/120) per hour × 24 × 30
// = 64,800 calls/month for the default feed. Plus searches at ~600s ≈ +20k.
// Well under 100k/month on the Business plan.

const SEARCH_PARAMS = new Set([
  "flight_iata",
  "flight_icao",
  "flight_number",
  "airline_iata",
  "airline_icao",
  "dep_iata",
  "dep_icao",
  "arr_iata",
  "arr_icao",
  "flight_date",
]);

function isSearchQuery(searchParams: URLSearchParams): boolean {
  for (const key of SEARCH_PARAMS) {
    if (searchParams.has(key)) return true;
  }
  return false;
}

type AviationstackFlight = {
  flight_status?: string | null;
  live?: { latitude?: number | null; longitude?: number | null } | null;
  departure?: { iata?: string | null; icao?: string | null } & Record<string, unknown>;
  arrival?: { iata?: string | null; icao?: string | null } & Record<string, unknown>;
};

type Payload = {
  pagination?: { limit: number; offset: number; count: number; total: number };
  data?: AviationstackFlight[];
  error?: { code?: string; message?: string };
};

async function fetchOnce(upstream: URL, revalidate: number): Promise<Payload | { httpError: number }> {
  const res = await fetch(upstream.toString(), {
    next: { revalidate, tags: ["aviationstack-flights"] },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { httpError: res.status };
  return (await res.json()) as Payload;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const API_KEY = process.env.AVIATION_STACK_API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: "AVIATION_STACK_API_KEY environment variable is not set." },
      { status: 401 }
    );
  }

  const search = isSearchQuery(searchParams);
  const revalidate = search ? SEARCH_QUERY_REVALIDATE_S : DEFAULT_FEED_REVALIDATE_S;

  // Throttle per client before doing any upstream work, so a single caller
  // can't drain the monthly Aviationstack quota with cache-busting queries.
  const limit = search ? SEARCH_LIMIT_PER_MIN : DEFAULT_FEED_LIMIT_PER_MIN;
  const rl = rateLimit(`${search ? "search" : "feed"}:${clientKey(request)}`, {
    limit,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down.", code: "client_rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    if (search) {
      // Search query: single call, narrow result set, pass user params through.
      const upstream = new URL("https://api.aviationstack.com/v1/flights");
      upstream.searchParams.set("access_key", API_KEY);
      upstream.searchParams.set("limit", searchParams.get("limit") ?? "100");
      upstream.searchParams.set("offset", searchParams.get("offset") ?? "0");
      upstream.searchParams.set("flight_status", searchParams.get("flight_status") ?? "active");
      for (const key of SEARCH_PARAMS) {
        const v = searchParams.get(key);
        if (v) upstream.searchParams.set(key, v);
      }
      const result = await fetchOnce(upstream, revalidate);
      return finalizeResponse(result, revalidate);
    }

    // Default feed: paginate up to FEED_MAX_PAGES, keep only flights with live
    // tracking data, return as a single payload.
    const aggregated: AviationstackFlight[] = [];
    let lastPagination: Payload["pagination"] | undefined;

    for (let page = 0; page < FEED_MAX_PAGES; page++) {
      const upstream = new URL("https://api.aviationstack.com/v1/flights");
      upstream.searchParams.set("access_key", API_KEY);
      upstream.searchParams.set("limit", String(FEED_PAGE_SIZE));
      upstream.searchParams.set("offset", String(page * FEED_PAGE_SIZE));
      upstream.searchParams.set("flight_status", "active");

      const result = await fetchOnce(upstream, revalidate);

      if ("httpError" in result) {
        return NextResponse.json(
          { error: `Aviationstack upstream returned ${result.httpError}` },
          { status: 502 }
        );
      }
      if (result.error) {
        const isQuota =
          result.error.code === "usage_limit_reached" ||
          result.error.code === "rate_limit_reached";
        return NextResponse.json(
          { error: result.error.message || result.error.code, code: result.error.code },
          { status: isQuota ? 429 : 400 }
        );
      }
      const data = result.data ?? [];
      aggregated.push(...data);
      lastPagination = result.pagination;
      if (data.length < FEED_PAGE_SIZE) break;
    }

    const trackable = aggregated
      .filter((f) => f.live && f.live.latitude != null && f.live.longitude != null)
      .map(enrichFlight);

    return NextResponse.json(
      {
        pagination: lastPagination
          ? { ...lastPagination, count: trackable.length }
          : { limit: FEED_PAGE_SIZE, offset: 0, count: trackable.length, total: trackable.length },
        data: trackable,
        // Extra metadata for the client to surface trackable-vs-total ratio.
        meta: { fetched: aggregated.length, trackable: trackable.length },
      },
      {
        headers: {
          // Never cache an empty trackable set: a single fluke-empty upstream
          // fetch would otherwise blank the map for every reload until the
          // window expired. Only cache responses that actually carry flights.
          "Cache-Control": trackable.length
            ? `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`
            : "no-store",
        },
      }
    );
  } catch (error) {
    const err = error as { message?: string };
    console.error("AviationStack error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch from AviationStack via proxy." },
      { status: 502 }
    );
  }
}

function finalizeResponse(
  result: Payload | { httpError: number },
  revalidate: number
): NextResponse {
  if ("httpError" in result) {
    return NextResponse.json(
      { error: `Aviationstack upstream returned ${result.httpError}` },
      { status: 502 }
    );
  }
  if (result.error) {
    const isQuota =
      result.error.code === "usage_limit_reached" ||
      result.error.code === "rate_limit_reached";
    return NextResponse.json(
      { error: result.error.message || result.error.code, code: result.error.code },
      { status: isQuota ? 429 : 400 }
    );
  }
  if (Array.isArray(result.data)) {
    result.data = result.data.map(enrichFlight);
  }
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`,
    },
  });
}

function enrichFlight<T extends AviationstackFlight>(flight: T): T {
  const dep = getAirport(flight.departure?.iata, flight.departure?.icao);
  const arr = getAirport(flight.arrival?.iata, flight.arrival?.icao);
  if (dep && flight.departure) {
    flight.departure = { ...flight.departure, latitude: dep.lat, longitude: dep.lon };
  }
  if (arr && flight.arrival) {
    flight.arrival = { ...flight.arrival, latitude: arr.lat, longitude: arr.lon };
  }
  return flight;
}
