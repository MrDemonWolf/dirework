// Boot the built web worker (apps/web/.open-next, the exact bundle the deploy ships) in local
// workerd, pointed at the e2e api worker. Playwright starts this as a webServer and waits for
// /api/version.

import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildSmokeConfig } from "../../../apps/web/scripts/smoke-worker.mjs";
import { API_ORIGIN, PROXY_SECRET, WEB_ORIGIN, WEB_PORT } from "./env";
import { assertPortFree, compatibilityDate, devWrangler, repoRoot } from "./wrangler";

await assertPortFree(WEB_PORT, "web worker");

const webDir = path.join(repoRoot, "apps/web");

if (!existsSync(path.join(webDir, ".open-next/worker.js"))) {
  console.error(
    "No web bundle at apps/web/.open-next. Run `bun run build:worker` in apps/web first (verify.yml does, before the e2e step).",
  );
  process.exit(1);
}

/**
 * The smoke check's config (same entrypoint, assets and runtime flags as the deploy), but
 * with a real api worker behind it: the same-origin proxy and the SSR session checks reach
 * it through NEXT_PUBLIC_SERVER_URL, and the browser's direct publicTrpc calls were baked
 * to the same origin at build time.
 */
const config = {
  ...buildSmokeConfig({ webDir, compatibilityDate: compatibilityDate() }),
  name: "dirework-web-e2e",
  vars: {
    BETTER_AUTH_URL: WEB_ORIGIN,
    NEXT_PUBLIC_SERVER_URL: API_ORIGIN,
    PROXY_SECRET,
  },
};

const stateDir = mkdtempSync(path.join(tmpdir(), "dirework-e2e-web-"));
const configPath = path.join(stateDir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(config, null, 2));

devWrangler(["-c", configPath, "--port", String(WEB_PORT), "--persist-to", stateDir], webDir);
