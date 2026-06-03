import type { Flight } from "./types";

// Persist the last good feed in the browser so a page reload shows planes
// instantly — before (and even instead of) a slow/empty/rate-limited refresh.
// This decouples "is there something on the map" from any server/CDN caching.

const KEY = "aerostack:flights:v1";
// Don't rehydrate a feed older than this; positions would be too stale to be
// useful (dead reckoning is clamped well below this anyway).
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

export function saveCachedFlights(data: Flight[]): void {
  if (typeof window === "undefined" || data.length === 0) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {
    // Quota or serialization failure — non-fatal, just skip persisting.
  }
}
