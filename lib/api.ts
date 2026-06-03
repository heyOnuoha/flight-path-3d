import type { Flight } from "./types";

export type FlightsResponse = {
  pagination?: { limit: number; offset: number; count: number; total: number };
  data?: Flight[];
  error?: string;
  code?: string;
};

export class FlightsApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Server-side caching (Next.js Data Cache + Cache-Control headers in
// app/api/flights/route.ts) makes each unique query share one upstream call
// across all users, so we don't need a per-browser localStorage cache anymore.
// Browser HTTP cache honors the `s-maxage` / `stale-while-revalidate` headers
// from the route handler for free.
async function get(path: string): Promise<FlightsResponse> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  let body: FlightsResponse | undefined;
  try {
    body = (await res.json()) as FlightsResponse;
  } catch {}
  if (!res.ok) {
    throw new FlightsApiError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      body?.code
    );
  }
  return body ?? {};
}

// 1,000 fits in a single Aviationstack request on Business+ plans. Each request
// costs the same quota regardless of `limit`, so we ask for as many flights as
// the plan allows in one call instead of paginating.
export async function fetchFlights(limit = 1000): Promise<FlightsResponse> {
  return get(`/api/flights?limit=${limit}`);
}

export async function searchFlights(query: string): Promise<Flight[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ limit: "20" });
  if (/^[A-Z0-9]{2}\d+$/i.test(trimmed)) {
    params.set("flight_iata", trimmed.toUpperCase());
  } else if (/^\d+$/.test(trimmed)) {
    params.set("flight_number", trimmed);
  } else if (/^[A-Z]{2}$/i.test(trimmed)) {
    params.set("airline_iata", trimmed.toUpperCase());
  } else {
    params.set("dep_iata", trimmed.toUpperCase());
  }

  const res = await get(`/api/flights?${params.toString()}`);
  return res.data ?? [];
}
