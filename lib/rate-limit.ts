// Lightweight in-memory rate limiter (fixed-window counter), used to protect
// the Aviationstack quota from a single client generating many distinct,
// cache-busting queries. The shared Next.js Data Cache already coalesces
// identical requests across users; this adds a per-client ceiling on top.
//
// Caveat: state lives in module memory, so it is per-instance and resets on
// cold start. On a multi-instance / serverless deployment it is best-effort,
// not a global guarantee — for hard global limits, back it with a shared store
// (Upstash Redis, Vercel KV, etc.). It is still effective against a single
// abusive client hitting one warm instance.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

// Evict expired windows opportunistically so the map can't grow without bound
// under a stream of unique keys.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
};

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

// Best-effort client identity from common proxy headers. Falls back to a shared
// bucket when no IP is available (e.g. local dev), which is acceptable since the
// limiter is a safety net rather than an auth boundary.
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "anonymous";
}
