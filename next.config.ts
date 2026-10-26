import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/basePath";

/**
 * `basePath` lets this app be served under a sub-path such as
 * /devtools/<tool>. Empty by default so local dev runs at the root; the
 * deployment sets NEXT_PUBLIC_BASE_PATH at build time.
 *
 * No `assetPrefix`: that is for CDNs, and the Next docs say plainly "we do not
 * suggest you use a custom Asset Prefix for this use case".
 */
const nextConfig: NextConfig = {
  basePath: BASE_PATH,
};

export default nextConfig;
