// Boot the api worker from source in local workerd over a fresh local D1 with every
// migration applied, with the DEV_LOGIN bypass on. Playwright starts this as a webServer and
// waits for /ready.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { API_PORT, BETTER_AUTH_SECRET, DEV_LOGIN_SECRET, PROXY_SECRET, WEB_ORIGIN } from "./env";
import { assertPortFree, compatibilityDate, devWrangler, repoRoot, runWrangler } from "./wrangler";

await assertPortFree(API_PORT, "api worker");

const serverDir = path.join(repoRoot, "apps/server");
// A fresh directory per run: wrangler keeps the local D1 under --persist-to, so every
// run starts from an empty database with only the migrations applied.
const stateDir = mkdtempSync(path.join(tmpdir(), "dirework-e2e-api-"));

/**
 * The bindings alchemy.run.ts gives the api worker, minus the rate limiters (the limiter
 * fails open without them) and with test values for the secrets. DEV_LOGIN is the only
 * thing production never has.
 */
const config = {
  name: "dirework-api-e2e",
  // The real app behind a test-only per-procedure delay knob (src/api-entry.ts).
  main: path.join(repoRoot, "packages/e2e/src/api-entry.ts"),
  compatibility_date: compatibilityDate(),
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: "dirework-db",
      database_id: "dirework-e2e",
      migrations_dir: path.join(repoRoot, "packages/db/src/migrations"),
    },
  ],
  vars: {
    CORS_ORIGIN: WEB_ORIGIN,
    BETTER_AUTH_URL: WEB_ORIGIN,
    BETTER_AUTH_SECRET,
    PROXY_SECRET,
    TWITCH_CLIENT_ID: "e2e-client-id",
    TWITCH_CLIENT_SECRET: "e2e-client-secret",
    DOCS_URL: "",
    DEV_LOGIN: "true",
    DEV_LOGIN_SECRET,
  },
};

const configPath = path.join(stateDir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(config, null, 2));

runWrangler(
  [
    "d1",
    "migrations",
    "apply",
    "dirework-db",
    "--local",
    "-c",
    configPath,
    "--persist-to",
    stateDir,
  ],
  serverDir,
);
devWrangler(["-c", configPath, "--port", String(API_PORT), "--persist-to", stateDir], serverDir);
