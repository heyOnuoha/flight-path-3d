/**
 * The sub-path this app is served from, e.g. "/devtools/real-time-tracker".
 *
 * Next wants "" for the root and rejects a trailing slash, so both the unset
 * case and a stray "/" normalise to "". Must be set at build time: Next inlines
 * it into the client bundle, so changing it needs a rebuild, not a restart.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/").replace(
  /\/+$/,
  ""
);
