/**
 * Worker bundle size check, run by verify.yml after `build:worker` and before the
 * runtime smoke check (`node ./node_modules/.bin/tsx bundle-budget.ts` from
 * packages/infra). Each worker gets two checks:
 *
 * - Cloudflare's limit: 64 MiB uncompressed on every plan, the `Total Upload`
 *   size wrangler prints. Since 2026-09-04 it is the only size Cloudflare checks
 *   at upload; the compressed 3 MB Free / 10 MB Paid check is gone, and the gzip
 *   size is for reference only
 *   (https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/).
 *   An upload past it is refused after the deploy has already applied the D1
 *   migrations, so failing here keeps that from being the first signal.
 * - Our ratchet: WORKER_BUDGET_KIB on the gzip size, a growth limit of our own.
 *
 * - api: apps/server/dist/index.js, the dry-run bundle the server's `build`
 *   script (wrangler deploy --dry-run) wrote earlier in the same run. It is the
 *   api's only module, so its size is the api's upload size.
 * - web: `wrangler deploy --dry-run` over the OpenNext output, with the config
 *   the runtime smoke check boots (buildSmokeConfig) plus Alchemy's
 *   `minify: true`, so the numbers are the ones Alchemy uploads — unminified
 *   they read about 13% high.
 *
 * The pure parts are unit-tested; main() runs only when this file is the
 * entrypoint.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { gzipSync } from "node:zlib";

import { buildSmokeConfig, readCompatibilityDate } from "../../apps/web/scripts/smoke-worker.mjs";

/**
 * Cloudflare's Worker size limit: 64 MiB uncompressed, on the Free and Paid plans
 * alike (https://developers.cloudflare.com/workers/platform/limits/).
 */
export const UNCOMPRESSED_LIMIT_KIB = 65536;

/**
 * Per-worker gzip budget: a ratchet of our own, not a platform limit. It stops a
 * bundle from growing unnoticed, and it stands in for cold-start cost, since every
 * KiB is script an isolate parses before it serves a request (verify.yml's startup
 * check measures that directly). Measured: api ~525 KiB, web ~1990 KiB at
 * introduction (2026-10, budget 2560); api 548 KiB, web 2117 KiB in 2026-11. With
 * next/og out of the Worker (the share card is a static file, apps/web/scripts/
 * render-og.ts) web fell to 1457 KiB, so the budget came down to 1600: about 10%
 * headroom, and far too little for og's ~760 KiB renderer to slip back in. Lower it
 * when a bundle shrinks for good; raise it only deliberately, with a reason, never
 * to turn a red run green.
 */
export const WORKER_BUDGET_KIB = 1600;

/** A worker's upload size in KiB: uncompressed (what Cloudflare limits) and gzip. */
export type WorkerSize = { rawKib: number; gzipKib: number };

/** Read both sizes from wrangler's `Total Upload: 6623.48 KiB / gzip: 2116.84 KiB` line. */
export function parseUploadSizes(output: string): WorkerSize {
  // wrangler colors the sizes when colors are on (yellow past 70% of the limit).
  const match = /Total Upload: ([\d.]+) KiB \/ gzip: ([\d.]+) KiB/.exec(
    stripVTControlCharacters(output),
  );
  if (!match) throw new Error("wrangler did not report the upload size");
  return { rawKib: Number(match[1]), gzipKib: Number(match[2]) };
}

/** Raw and compressed size of a bundle in KiB, rounded the way wrangler prints them. */
export function bundleSizes(bytes: Uint8Array): WorkerSize {
  const kib = (length: number) => Number((length / 1024).toFixed(2));
  return { rawKib: kib(bytes.length), gzipKib: kib(gzipSync(bytes).length) };
}

/**
 * Every reason a worker fails: over Cloudflare's uncompressed limit, which no
 * budget can lift, or over the gzip budget. A size exactly at either passes.
 */
export function sizeFailures(
  sizes: Record<string, WorkerSize>,
  budgetKib: number = WORKER_BUDGET_KIB,
): string[] {
  const failures: string[] = [];
  for (const [name, { rawKib, gzipKib }] of Object.entries(sizes)) {
    if (rawKib > UNCOMPRESSED_LIMIT_KIB) {
      failures.push(
        `${name}: ${rawKib} KiB uncompressed is over Cloudflare's ${UNCOMPRESSED_LIMIT_KIB} KiB limit, so the upload would be refused`,
      );
    }
    if (gzipKib > budgetKib) {
      failures.push(`${name}: ${gzipKib} KiB gzip is over the ${budgetKib} KiB budget`);
    }
  }
  return failures;
}

/**
 * The runtime smoke check's wrangler config (same entrypoint, assets and flags
 * as the deploy), minified like Alchemy's bundle (alchemy.run.ts `bundle.minify`).
 */
export function webDryRunConfig(input: { webDir: string; compatibilityDate: string }) {
  return { ...buildSmokeConfig(input), name: "dirework-web-budget", minify: true };
}

function measureWeb(repoRoot: string, webDir: string): WorkerSize {
  const compatibilityDate: string | undefined = readCompatibilityDate(
    readFileSync(path.join(repoRoot, "packages/infra/deploy-config.ts"), "utf8"),
  );
  if (!compatibilityDate) {
    throw new Error("COMPATIBILITY_DATE not found in packages/infra/deploy-config.ts");
  }
  const dir = mkdtempSync(path.join(tmpdir(), "dirework-budget-"));
  try {
    const configPath = path.join(dir, "wrangler.json");
    writeFileSync(
      configPath,
      JSON.stringify(webDryRunConfig({ webDir, compatibilityDate }), null, 2),
    );
    const result = spawnSync(
      path.join(webDir, "node_modules/.bin/wrangler"),
      ["deploy", "--dry-run", "--outdir", path.join(dir, "out"), "-c", configPath],
      { cwd: webDir, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, encoding: "utf8" },
    );
    if (result.status !== 0) {
      const tail = `${result.stdout}${result.stderr}`.split("\n").slice(-30).join("\n");
      throw new Error(`wrangler deploy --dry-run exited ${result.status}\n${tail}`);
    }
    return parseUploadSizes(result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const apiBundle = path.join(repoRoot, "apps/server/dist/index.js");
  const webDir = path.join(repoRoot, "apps/web");
  if (!existsSync(apiBundle)) {
    console.error(
      "No api bundle at apps/server/dist/index.js. Run `bun run build` in apps/server first (verify.yml's production build step does).",
    );
    process.exit(1);
  }
  if (!existsSync(path.join(webDir, ".open-next/worker.js"))) {
    console.error(
      "No web bundle at apps/web/.open-next. Run `bun run build:worker` in apps/web first (verify.yml does, right before this step).",
    );
    process.exit(1);
  }

  const sizes = { api: bundleSizes(readFileSync(apiBundle)), web: measureWeb(repoRoot, webDir) };
  for (const [name, { rawKib, gzipKib }] of Object.entries(sizes)) {
    console.log(
      `${name}: ${rawKib.toFixed(2)} KiB uncompressed (Cloudflare limit ${UNCOMPRESSED_LIMIT_KIB} KiB), ${gzipKib.toFixed(2)} KiB gzip (budget ${WORKER_BUDGET_KIB} KiB)`,
    );
  }

  const failures = sizeFailures(sizes);
  if (failures.length > 0) {
    console.error(
      `Worker bundle size check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\nTrim the bundle. WORKER_BUDGET_KIB in packages/infra/bundle-budget.ts may be raised with a reason; Cloudflare's limit can't.`,
    );
    process.exit(1);
  }
  console.log("Worker bundle size check passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
