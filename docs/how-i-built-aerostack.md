# How I Built AeroStack: A Live Flight Tracker with Next.js, Leaflet, and the Aviationstack API

A few months ago I set out to build a live flight tracker. Not a toy with three hardcoded planes, but something you could open in a browser and watch a thousand real aircraft move across a map in real time. That project became [AeroStack](https://apilayer.com/devtools/aerostack).

This is the full write-up of how it works: the architecture, the code, the parts that broke, and the fixes. I am going to show you real code from the repository, not pseudocode. If you follow along you will end up with a working flight tracker and, more usefully, an understanding of the problems you hit when you put a paid third-party API behind a public web app.

![AeroStack hero screenshot showing the dark world map with hundreds of blue plane markers](./images/aerostack-hero.png)
> **Screenshot to capture:** The app at default zoom (world view, dark basemap) with the flight list open on the left and a few hundred planes visible.

---

## What I was actually building

The brief was simple to state and annoying to deliver:

1. Show every trackable active flight on a world map.
2. Let the user click a plane and see its route, telemetry, and schedule.
3. Let the user search by flight number, airline, or airport.
4. Do all of that without burning through the API quota in a weekend.

Point four is the one that shaped almost every architectural decision in this project. Keep it in mind as you read.

## The stack

Here is what I settled on and why.

- **Next.js 16 (App Router)** for the framework. I needed a server layer to hide the API key and to cache upstream responses. A route handler gives me both with no separate backend.
- **Leaflet 1.9** for the map. More on this below, because I did not start here.
- **Tailwind CSS v4** for styling.
- **Framer Motion** for the panel and modal transitions.
- **date-fns** for time formatting.
- **lucide-react** for icons.
- **Aviationstack** (by APILayer) for the flight data itself.

The full dependency list from `package.json`:

```json
{
  "dependencies": {
    "date-fns": "^4.1.0",
    "framer-motion": "^12.38.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^1.7.0",
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  }
}
```

That is a short list on purpose. There is no state management library, no data fetching library, no map wrapper library. For an app this size, `useState` and `fetch` are enough, and every dependency you skip is one you never have to debug at 1am.

### Why I dropped the 3D globe

The project started life as "FlightPath3D". The first version was a Three.js globe with aircraft meshes orbiting a textured sphere. It looked great in a screenshot.

It was also the wrong tool. At the zoom level where you can see the whole world, a 3D globe hides half your data behind the horizon. Panning is fiddly. Labels are hard to read because they sit on a curved surface. And the frame budget that the globe eats is budget you cannot spend on rendering a thousand markers.

I rewrote it as a 2D Leaflet map and the app immediately got better. Every flight is visible at once, panning is a drag, and Leaflet's marker layer handles a thousand DOM markers without complaint. The old Three.js code still sits in `example/` in the repo as a reference.

The lesson I took from it: pick the projection that serves the data, not the one that demos well.

---

## Prerequisites

Before you write a line of code, get these in place.

**Node.js 20.9 or newer.** Next.js 16 declares `"node": ">=20.9.0"` in its engines field. If you are on 18 the install will appear to work and then fail in confusing ways. Check with:

```bash
node -v
```

**An Aviationstack API key.** Sign up at [apilayer.com](https://app.apilayer.com/signup/aviationstack/). The free tier is fine for building and testing. Be aware that the `live` telemetry block (the actual latitude and longitude of the aircraft) is a paid feature on most plans, and the default feed pagination I describe later assumes a plan that allows a `limit` of 1000 per request.

**A package manager.** npm, pnpm, yarn, or bun. I used npm.

That is it. No database, no Redis, no map tile account. The basemap tiles come from CARTO, OpenStreetMap, and Esri, all of which serve public tiles with attribution.

## Environment variables

There are only two, and only one of them is required.

Copy the example file:

```bash
cp .env.example .env.local
```

Then fill it in:

```env
# Required. Your Aviationstack API key.
AVIATION_STACK_API_KEY=your_key_here

# Optional. Only used by the legacy 3D globe in example/.
# The 2D app does not read this.
NEXT_PUBLIC_CESIUM_ION_TOKEN=
```

Notice what is missing: the `NEXT_PUBLIC_` prefix on the Aviationstack key. That is deliberate and it is the single most important line in this section. Any variable prefixed with `NEXT_PUBLIC_` gets inlined into the JavaScript bundle that ships to the browser. If you put your API key there, anyone can open devtools, read it, and spend your quota. `AVIATION_STACK_API_KEY` has no prefix, so it exists only in the Node process. The browser never sees it.

## Installing and running

```bash
git clone https://github.com/heyOnuoha/flight-path-3d.git
cd flight-path-3d
npm install
npm run dev
```

Open `http://localhost:3000`.

One thing to note about `npm install`: there is a `postinstall` hook.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "predev": "node scripts/fetch-airports.mjs",
    "prebuild": "node scripts/fetch-airports.mjs",
    "postinstall": "node scripts/fetch-airports.mjs",
    "fetch-airports": "node scripts/fetch-airports.mjs --force"
  }
}
```

I will explain what that script does in a moment, because it solves a problem you will not see coming.

---

## Step 1: Type the data before you touch it

Aviationstack returns deeply nested JSON where almost every field is nullable. If you start pulling values out of it without a type, you will spend the rest of the project chasing `undefined is not an object`.

So the first file I wrote was `lib/types.ts`:

```ts
export type Flight = {
  flight_date: string | null;
  flight_status: string | null;
  airline: { name: string | null; iata: string | null; icao: string | null } | null;
  flight: {
    number: string | null;
    iata: string | null;
    icao: string | null;
    codeshared: unknown;
  } | null;
  aircraft: {
    registration: string | null;
    iata: string | null;
    icao: string | null;
    icao24: string | null;
  } | null;
  departure: AirportRef | null;
  arrival: AirportRef | null;
  live: LiveTelemetry | null;
};

export type LiveTelemetry = {
  updated: string;
  latitude: number;
  longitude: number;
  altitude: number;
  direction: number;
  speed_horizontal: number;
  speed_vertical: number;
  is_ground: boolean;
} | null;
```

Every field is `| null` because every field really can be null. Model the API you have, not the API you wish you had.

The other thing in this file is a function that turned out to matter more than it looks:

```ts
export function flightKey(f: Flight, idx?: number): string {
  const base = f.flight?.iata || f.flight?.icao || f.flight?.number || "F";
  const route =
    f.departure?.iata && f.arrival?.iata ? `${f.departure.iata}-${f.arrival.iata}` : null;
  const suffix = f.aircraft?.registration || route || (idx ?? 0);
  return `${base}-${suffix}`;
}
```

This is the stable identity of a flight. It deliberately does not include position. My first version keyed markers on latitude and longitude, which meant every poll produced a brand new key for every plane. React tore down and rebuilt a thousand markers every two minutes, selection broke the moment a plane moved, and the map flickered. Keying on registration (falling back to the route pair) fixed all three bugs at once.

## Step 2: Put the API behind your own route

Never call Aviationstack from the browser. Put a route handler in front of it. In the App Router that is a `route.ts` file:

```ts
// app/api/flights/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const API_KEY = process.env.AVIATION_STACK_API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: "AVIATION_STACK_API_KEY environment variable is not set." },
      { status: 401 }
    );
  }
  // ...
}
```

The proxy buys you four things:

1. The key stays on the server.
2. You get one place to cache.
3. You get one place to rate limit.
4. You can reshape the upstream payload before the client ever sees it, which is where a lot of the value in this project ended up living.

## Step 3: The quota problem

Here is the arithmetic that nearly killed the project.

Aviationstack bills per request. Say a hundred people have AeroStack open. If each browser polls every two minutes, that is 3,000 requests an hour, which is over two million a month. There is no plan that survives that.

The fix is that all of those users are asking the exact same question, so they should share one answer. Next.js gives you this through the Data Cache, which you opt into per fetch:

```ts
async function fetchOnce(upstream: URL, revalidate: number): Promise<Payload | { httpError: number }> {
  const res = await fetch(upstream.toString(), {
    next: { revalidate, tags: ["aviationstack-flights"] },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { httpError: res.status };
  return (await res.json()) as Payload;
}
```

`next: { revalidate }` tells Next.js to cache the result of this upstream call for that many seconds and serve it to everyone. A hundred users polling inside the window produce one upstream call, not a hundred. The `tags` array gives me a handle to bust that cache on demand later with `revalidateTag`.

I use two different windows:

```ts
const DEFAULT_FEED_REVALIDATE_S = 120;
const SEARCH_QUERY_REVALIDATE_S = 600;
```

The default feed refreshes every two minutes so the map feels live. Search queries cache for ten minutes, because a search is cache-busting by nature: every distinct query string is a new cache entry and therefore a new upstream call. Searches are the real quota risk, so they get the longer window.

Then I layer HTTP caching on top so the browser and any CDN in front of the app also respect the window:

```ts
{
  headers: {
    "Cache-Control": trackable.length
      ? `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`
      : "no-store",
  },
}
```

Read that ternary carefully, because it is a bug fix rather than a feature. If a refresh comes back with zero trackable flights (it happens, upstream hiccups), I must not cache that response. If I did, every visitor for the next two minutes would get a cached empty array and stare at a blank map. Empty responses are marked `no-store` so the next request retries for real.

### Pagination, and why I fetch three pages

Most flights Aviationstack marks as `active` come back with no `live` block at all. If you request 100 flights you might get eight with coordinates. To fill a world map you have to fetch a much larger pool and keep the ones you can actually plot:

```ts
const FEED_PAGE_SIZE = 1000;
const FEED_MAX_PAGES = 3;
```

```ts
const aggregated: AviationstackFlight[] = [];
let lastPagination: Payload["pagination"] | undefined;

for (let page = 0; page < FEED_MAX_PAGES; page++) {
  const upstream = new URL("https://api.aviationstack.com/v1/flights");
  upstream.searchParams.set("access_key", API_KEY);
  upstream.searchParams.set("limit", String(FEED_PAGE_SIZE));
  upstream.searchParams.set("offset", String(page * FEED_PAGE_SIZE));
  upstream.searchParams.set("flight_status", "active");

  const result = await fetchOnce(upstream, revalidate);
  // ... error handling ...

  const data = result.data ?? [];
  aggregated.push(...data);
  lastPagination = result.pagination;
  if (data.length < FEED_PAGE_SIZE) break;
}

const trackable = aggregated
  .map(ensureLiveTelemetry)
  .filter((f) => f.live && f.live.latitude != null && f.live.longitude != null);
```

Three pages of a thousand is three upstream calls per refresh. At one refresh every 120 seconds that is 30 refreshes an hour, so:

`3 × 30 × 24 × 30 = 64,800 calls a month`

Add roughly 20,000 for searches and the whole app runs in under 85,000 calls a month regardless of how many people use it. That number is fixed by the cache window, not by traffic. This is the single most important property of the design.

## Step 4: Rate limiting as a safety net

Caching protects you from honest traffic. It does nothing against someone who scripts a loop of unique search queries, because every unique query misses the cache and costs a call.

So there is a small fixed-window limiter in `lib/rate-limit.ts`:

```ts
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  return { ok: existing.count <= limit, remaining, retryAfter };
}
```

Searches get a tighter budget than the feed, for the reason above:

```ts
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_FEED_LIMIT_PER_MIN = 60;
const SEARCH_LIMIT_PER_MIN = 20;
```

And it runs before any upstream work happens:

```ts
const rl = rateLimit(`${search ? "search" : "feed"}:${clientKey(request)}`, {
  limit,
  windowMs: RATE_LIMIT_WINDOW_MS,
});
if (!rl.ok) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down.", code: "client_rate_limited" },
    { status: 429, headers: { "Retry-After": String(rl.retryAfter), "Cache-Control": "no-store" } }
  );
}
```

Be honest about what this is. The state lives in module memory, so it is per-instance and it resets on cold start. On a serverless deployment with several instances it is best-effort, not a global guarantee. If you need a hard global limit, back it with Upstash Redis or Vercel KV. As a cheap guard against one abusive client hitting one warm instance, it does the job.

## Step 5: The missing coordinates

This is the part of the project I did not plan for.

Aviationstack gives you `departure.iata` and `arrival.iata`, but it does not give you the latitude and longitude of those airports in the flights response. And as I mentioned, most active flights have no `live` block. So for a large share of the feed I had a flight with a real route and no way to draw it anywhere.

Two fixes, in order.

**First, get airport coordinates.** Aviationstack has an `/airports` endpoint, but it returns 6,471 entries and every call costs quota. Instead I pull a public CC0 dataset once at install time:

```js
// scripts/fetch-airports.mjs
const SOURCE_URL =
  "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const OUT = path.resolve("lib/airports.json");

const byIata = {};
const byIcao = {};

for (const [icaoKey, info] of Object.entries(raw)) {
  const i = info;
  const lat = Number(i.lat);
  const lon = Number(i.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const record = {
    name: i.name ?? null,
    iata: i.iata || null,
    icao: i.icao || icaoKey,
    lat,
    lon,
    tz: i.tz ?? null,
    country: i.country ?? null,
  };
  if (record.iata) byIata[record.iata] = record;
  if (record.icao) byIcao[record.icao] = record;
}

await writeFile(OUT, JSON.stringify({ byIata, byIcao }, null, 0));
```

On the current dataset that writes 29,305 airports indexed by ICAO and 7,914 by IATA, as a plain JSON file bundled into the server build. The IATA index is the smaller of the two because most of those 29,000 airfields are regional strips with no commercial code, but 7,914 still beats the 6,471 you get from the metered endpoint, and lookups are a hash hit with zero quota cost:

```ts
// lib/airports.ts
export function getAirport(iata?: string | null, icao?: string | null): Airport | null {
  if (iata && db.byIata[iata]) return db.byIata[iata];
  if (icao && db.byIcao[icao]) return db.byIcao[icao];
  return null;
}
```

**Second, estimate a position.** With both endpoints on the map I can place a flight along its great circle based on how far into its schedule it is:

```ts
function ensureLiveTelemetry<T extends AviationstackFlight>(flight: T): T {
  const enriched = enrichFlight(flight);
  if (enriched.live && enriched.live.latitude != null && enriched.live.longitude != null) {
    return enriched;
  }
  if (
    enriched.departure?.latitude != null &&
    enriched.arrival?.latitude != null
    /* ...and both longitudes... */
  ) {
    const depTime = new Date(
      enriched.departure.actual || enriched.departure.estimated || enriched.departure.scheduled || ""
    ).getTime();
    const arrTime = new Date(
      enriched.arrival.estimated || enriched.arrival.scheduled || ""
    ).getTime();

    let progress = 0.5;
    if (!isNaN(depTime) && !isNaN(arrTime) && arrTime > depTime) {
      progress = (Date.now() - depTime) / (arrTime - depTime);
      if (progress < 0 || progress > 1) {
        progress = getDeterministicProgress(getFlightKey(enriched));
      }
    } else {
      progress = getDeterministicProgress(getFlightKey(enriched));
    }

    const coords = interpolateDegrees(depLat, depLon, arrLat, arrLon, progress);
    const heading = calculateBearing(depLat, depLon, arrLat, arrLon);

    enriched.live = {
      updated: new Date().toISOString(),
      latitude: coords.lat,
      longitude: coords.lon,
      altitude: 10000,
      direction: heading,
      speed_horizontal: 850,
      speed_vertical: 0,
      is_ground: false,
    };
  }
  return enriched;
}
```

Two details worth calling out.

The interpolation is spherical, not linear. Averaging two latitude and longitude pairs gives you a point that is not on the actual route, and the error grows to hundreds of kilometres on a long haul. `interpolateDegrees` does proper great-circle interpolation by converting to radians, computing the angular distance, and slerping between the two points.

And the fallback is deterministic, not random:

```ts
function getDeterministicProgress(flightStr: string, durationMinutes = 120): number {
  let hash = 0;
  for (let i = 0; i < flightStr.length; i++) {
    hash = flightStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const baseOffset = (Math.abs(hash) % 50) / 100;
  const cycleMs = durationMinutes * 60 * 1000;
  const timeProgress = (Date.now() % cycleMs) / cycleMs;
  const progress = (baseOffset + timeProgress) % 1.0;
  return 0.05 + progress * 0.9;
}
```

If a flight has no usable schedule, I hash its key to get a stable starting offset and advance it with wall-clock time. Using `Math.random()` here would make the same plane teleport to a different point on its route every single refresh. Hashing means it stays put and moves forward smoothly.

I want to be explicit about something: these positions are estimates, and the app says so. The interpolated flights fill in a map that would otherwise be mostly empty, but a flight with a genuine `live` block is always used as-is and never overwritten.

---

## Step 6: Rendering the map

Leaflet is not React-aware, so `Map2D.tsx` is a client component that owns its own imperative lifecycle through refs.

```tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
```

Because Leaflet touches `window` on import, the component cannot be server-rendered. I load it dynamically from the page:

```tsx
const Map2D = dynamic(() => import("@/components/Map2D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#050510]" />,
});
```

The `loading` fallback is a solid dark rectangle in the app's background colour, so there is no white flash before the tiles paint.

Map setup:

```tsx
const map = L.map(mapContainerRef.current, {
  zoomControl: false,
  attributionControl: true,
  fadeAnimation: true,
  minZoom: 2,
  worldCopyJump: true,
}).setView([20, 0], 3);
```

`worldCopyJump` with no `maxBounds` means the world repeats horizontally. That matters for the dateline, which I will get to.

One more setup detail that cost me an afternoon:

```tsx
const ensureSize = () => map.invalidateSize();
requestAnimationFrame(ensureSize);
const sizeTimer = setTimeout(ensureSize, 300);
const resizeObserver = new ResizeObserver(ensureSize);
resizeObserver.observe(mapContainerRef.current);
```

If Leaflet initialises before its container has final dimensions, it renders tiles but places markers in the wrong spot or not at all. Calling `invalidateSize` on the next frame, again after layout settles, and on every resize, makes that class of bug disappear.

![Flight detail panel showing telemetry, route progress bar, and airport pins](./images/aerostack-detail-panel.png)
> **Screenshot to capture:** A selected flight with the detail drawer open on the right, the curved route line on the map, and the departure and arrival pins visible.

## Step 7: Making the planes move

The feed refreshes every two minutes. If markers only moved when new data arrived, you would be looking at a still image 119 seconds out of every 120.

The answer is dead reckoning. Take the last reported position, heading, and speed, and project forward:

```tsx
function deadReckon(live: NonNullable<Flight["live"]>, elapsedSec: number) {
  const speedKmh = live.speed_horizontal || 800;
  const headingDeg = live.direction || 0;
  const distanceKm = (speedKmh / 3600) * elapsedSec * LOCAL_ANIM_SPEEDUP;

  const lat1 = (live.latitude * Math.PI) / 180;
  const lon1 = (live.longitude * Math.PI) / 180;
  const bearing = (headingDeg * Math.PI) / 180;
  const dR = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI, alt: live.altitude || 10000 };
}
```

Three things about this that are not obvious:

**The speed is exaggerated on purpose.**

```tsx
const LOCAL_ANIM_SPEEDUP = 10;
const MAX_LOCAL_ANIM_SEC = 600;
```

At world zoom a jet covers less than one pixel per minute. Rendered at true speed the map looks frozen. A 10x multiplier makes drift visible. This makes the animation a visual estimate rather than a literal track, which is a trade I made knowingly and which the copy in the app reflects.

**The clock resets on every new fix, and it is capped.**

```tsx
const animBase = new Map<string, { updated: string | null; baseTime: number }>();

function animElapsedSec(key: string, updated: string | null, nowMs: number): number {
  let base = animBase.get(key);
  if (!base || base.updated !== updated) {
    base = { updated, baseTime: nowMs };
    animBase.set(key, base);
  }
  return Math.min(MAX_LOCAL_ANIM_SEC, Math.max(0, (nowMs - base.baseTime) / 1000));
}
```

Aviationstack timestamps are often ten minutes stale. Extrapolating from the reported timestamp would fling planes far off course the moment they loaded. Instead I animate from the wall-clock moment I first saw a given fix, and reset to truth whenever `updated` changes. The 600 second cap bounds how far a plane can wander if the feed stops updating.

**The icon is cached, the position is not.** The update loop runs once a second over a thousand markers. Rebuilding an SVG `divIcon` for each one every tick would melt the main thread. So each marker remembers what it was last rendered with:

```tsx
type PlaneEntry = { marker: L.Marker; heading: number; selected: boolean };
```

```tsx
const entry = planeMarkersRef.current.get(key);
if (!entry) {
  const marker = L.marker([lat, lon], {
    icon: createPlaneIcon(heading, isSelected),
    zIndexOffset: isSelected ? 1000 : 0,
  }).addTo(map);
  marker.on("click", () => onSelectFlight(flight));
  planeMarkersRef.current.set(key, { marker, heading, selected: isSelected });
} else {
  entry.marker.setLatLng([lat, lon]);
  if (entry.heading !== heading || entry.selected !== isSelected) {
    entry.marker.setIcon(createPlaneIcon(heading, isSelected));
    entry.marker.setZIndexOffset(isSelected ? 1000 : 0);
    entry.heading = heading;
    entry.selected = isSelected;
  }
}
```

`setLatLng` is cheap and runs every tick. `setIcon` is expensive and only runs when the heading (rounded to a whole degree, so sub-degree noise does not trigger it) or the selection state actually changed.

Finally, the motion between ticks is CSS, not JavaScript:

```css
.custom-plane-container {
  transition: transform 1s linear;
}
.planes-no-anim .custom-plane-container {
  transition: none;
}
```

A one second linear transition on the marker's transform turns a once-per-second jump into continuous glide, for free, on the compositor. But it has to be switched off while the user pans or zooms, because those operations reproject every marker at once and the transition would make the planes visibly slide to catch up with the tiles:

```tsx
const freezeAnim = () => container?.classList.add("planes-no-anim");
const resumeAnim = () => container?.classList.remove("planes-no-anim");
map.on("movestart zoomstart", freezeAnim);
map.on("moveend zoomend", resumeAnim);
```

## Step 8: The dateline bug

Pick a Hong Kong to Anchorage flight and the route line shot backwards across the entire map, through Europe and the Atlantic, instead of hopping the short way over the Pacific.

The cause is that a great circle crossing 180° produces a longitude sequence like `175, -175, -165`. Leaflet reads that as an enormous westward jump. The fix is to unwrap the sequence so it reads `175, 185, 195` and stays continuous:

```tsx
for (let i = 1; i < points.length; i++) {
  const delta = points[i][1] - points[i - 1][1];
  if (delta > 180) points[i][1] -= 360;
  else if (delta < -180) points[i][1] += 360;
}
```

Combined with horizontally wrapping tiles, that renders the short Pacific route correctly.

The same trick is needed when framing the camera on a selected route:

```tsx
function unwrapLon(lon: number, ref: number): number {
  while (lon - ref > 180) lon -= 360;
  while (lon - ref < -180) lon += 360;
  return lon;
}
```

```tsx
const bounds = L.latLngBounds([
  [dep.latitude!, unwrapLon(dep.longitude!, anchorLon)],
  [arr.latitude!, unwrapLon(arr.longitude!, anchorLon)],
]);
map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 7, duration: 1.2 });
```

Without it, `flyToBounds` zooms out to fit a box spanning the whole planet.

## Step 9: Never show an empty map

Two separate failure modes produce a blank map, and both needed fixing.

**Reloads.** A cold load has nothing to draw until the first fetch resolves. So I persist the last good feed to `localStorage`:

```ts
const KEY = "aerostack:flights:v1";
const MAX_AGE_MS = 30 * 60_000;

export function loadCachedFlights(): Flight[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; data: Flight[] };
    if (!Array.isArray(parsed.data) || Date.now() - parsed.t > MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
```

Note the age check and the `try/catch`. Positions older than thirty minutes are too stale to be worth showing, and `localStorage` throws in private browsing and when the quota is full, so every access is wrapped.

**Sparse refreshes.** This one is subtler. Occasionally a refresh comes back with very few flights or none at all. If I blindly assigned that to state, every plane would vanish until the next good poll.

```tsx
const next = data?.data ?? [];
if (next.length > 0) {
  setFlights(next);
  saveCachedFlights(next);
  hasFlights = true;
}
```

Only swap in a feed that actually has flights. Keep showing the previous one otherwise.

The polling interval adapts to the same signal:

```tsx
timer = setTimeout(loadData, hasFlights ? 2 * 60_000 : 6_000);
```

Retry every six seconds until real data arrives, then settle into the two minute cycle that matches the server's revalidate window. Polls inside that window are cache hits and cost nothing upstream.

## Step 10: Search that does not cost you anything

The search box runs two searches at once. The first is local, instant, and free, over the flights already loaded:

```tsx
const localResults = useMemo(() => {
  if (trimmed.length < 2) return [];
  const q = trimmed.toLowerCase();
  return flights.filter((f) => flightMatchesQuery(f, q)).slice(0, 30);
}, [flights, trimmed]);
```

The second is a debounced call to the server, as a fallback for flights outside the loaded feed:

```tsx
useEffect(() => {
  if (trimmed.length < 2) {
    setApiResults([]);
    return;
  }
  setLoading(true);
  const handle = setTimeout(async () => {
    try {
      setApiResults(await searchFlights(trimmed));
    } catch {
      setApiResults([]);
    } finally {
      setLoading(false);
    }
  }, 400);
  return () => clearTimeout(handle);
}, [trimmed]);
```

A 400ms debounce on a two character minimum is the difference between one upstream call and eight while somebody types "Emirates".

On the client side, the query shape decides which Aviationstack parameter to use:

```ts
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
```

`BA117` is a flight, `117` is a flight number, `BA` is an airline, and anything else gets treated as a departure airport. Cheap heuristics, and they cover nearly every query a user actually types.

![Search dropdown showing matched flights with ON MAP badges](./images/aerostack-search.png)
> **Screenshot to capture:** The header search open with a query like "BA" typed, showing the results dropdown with both local and API results.

## Step 11: Answering the obvious questions

The last piece was an FAQ. People open a flight tracker and immediately want to know where the data comes from and how current it is. Burying that in a footer link is how you get support email.

There were five buttons in the flight detail panel that were decorative rather than functional, left over from an earlier design. I replaced the first one with something that does a job:

```tsx
<button
  onClick={onOpenFaq}
  className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300"
>
  <HelpCircle className="w-4 h-4" />
  <span>FAQ</span>
</button>
```

The modal state lives in `UIOverlay` so that both the panel button and a second entry point in the header can open it. That second entry point matters: the detail panel only exists once you have selected a flight, so without a header button the FAQ would be unreachable on first load.

Escape closes it, like every other panel in the app:

```tsx
useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [open, onClose]);
```

![FAQ modal open over the map](./images/aerostack-faq.png)
> **Screenshot to capture:** The FAQ modal open with the first question expanded, map dimmed behind it.

---

## What I would do differently

**Move the rate limiter into a shared store.** In-memory buckets are fine for one warm instance and useless across a serverless fleet. Upstash Redis is a twenty line change and I should have done it up front.

**Use a canvas renderer for markers.** A thousand DOM markers is fine. Ten thousand would not be. Leaflet has canvas renderers and `leaflet.markercluster` exists. I left this alone because the current feed size does not need it, but it is the first thing I would change if the trackable count grew.

**Label the estimated positions in the UI.** The app distinguishes real `live` telemetry from interpolated positions internally, but a user cannot tell which is which by looking. A small badge on the detail panel would fix that, and I think it is the right thing to do when you are showing people estimates.

**Write the types from the real payload sooner.** I hand-wrote `AviationstackFlight` from the docs and then spent a while reconciling it with what the API actually returns. Dumping one real response to a file and generating types from it would have been faster.

## Wrapping up

The interesting engineering in AeroStack is not the map. Leaflet does the map. The interesting parts are all downstream of one constraint: a metered upstream API and an unmetered number of users.

Everything else follows from that. The route handler exists so there is one place to cache. The cache windows exist so cost is fixed rather than proportional to traffic. The rate limiter exists because cache-busting queries are the hole in that plan. The local airport dataset exists so enrichment costs nothing. Dead reckoning exists so a two minute refresh can look like a live feed. The localStorage cache and the empty-response guards exist so that none of the above ever leaves a user staring at a blank screen.

If you take one idea from this, take that one. When you build on top of a paid API, work out your per-month call ceiling on paper before you write the fetch. The architecture writes itself from there.

The live app is at [apilayer.com/devtools/aerostack](https://apilayer.com/devtools/aerostack), and the flight data comes from the [Aviationstack API](https://app.apilayer.com/signup/aviationstack/), which has a free tier if you want to build your own.
