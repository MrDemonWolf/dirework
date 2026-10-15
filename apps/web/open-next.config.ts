import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Read-only cache served from the ASSETS binding, so prerendered routes (e.g.
// /opengraph-image) render once at build instead of on every request. Enough
// because the app uses no ISR or on-demand revalidation. `build:worker` runs
// `populateCache local` to copy the build cache into the uploaded assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
