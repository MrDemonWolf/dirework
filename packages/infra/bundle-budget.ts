/**
 * Worker bundle budget, run by verify.yml after `build:worker` and before the
 * runtime smoke check (`node ./node_modules/.bin/tsx bundle-budget.ts` from
 * packages/infra). The free Workers plan caps a script at 3 MiB compressed and
 * rejects the upload past it — after the deploy has already applied the D1
 * migrations. Failing here, with headroom, keeps that from being the first
 * signal.
 *
 * - api: gzip of apps/server/dist/index.js, the dry-run bundle the server's
 *   `build` script (wrangler deploy --dry-run) wrote earlier in the same run.
 * - web: `wrangler deploy --dry-run` over the OpenNext output, with the config
 *   the runtime smoke check boots (buildSmokeConfig) plus Alchemy's
 *   `minify: true`, so the number is the one Alchemy uploads — unminified it
 *   reads about 13% high.
 *
 * The pure parts are unit-tested; main() runs only when this file is the
 * entrypoint.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { buildSmokeConfig, readCompatibilityDate } from "../../apps/web/scripts/smoke-worker.mjs";

/** Cloudflare's compressed script size cap on the free plan (3 MiB). */
export const FREE_PLAN_WORKER_CAP_KIB = 3072;

/**
 * Per-worker budget: 512 KiB under the cap, so the budget trips while a deploy
 * would still succeed and there is room to react. Measured at introduction
 * (2026-10): api ~525 KiB, web ~1990 KiB. Raise it deliberately, with a reason,
 * never to turn a red run green.
 */
export const WORKER_BUDGET_KIB = 2560;

/** Read the compressed size from wrangler's `Total Upload: … / gzip: 524.77 KiB` line. */
export function parseGzipKib(output: string): number {
  const match = /gzip: ([\d.]+) KiB/.exec(output);
  if (!match) throw new Error("wrangler did not report a gzip size");
  return Number(match[1]);
}

/** Compressed size of a bundle in KiB, rounded the way wrangler prints it. */
export function gzipKib(bytes: Uint8Array): number {
  return Number((gzipSync(bytes).length / 1024).toFixed(2));
}

/** Names of the workers whose compressed size exceeds the budget. */
export function overBudget(sizes: Record<string, number>, budgetKib: number): string[] {
  return Object.entries(sizes)
    .filter(([, kib]) => kib > budgetKib)
    .map(([name]) => name);
}

/**
 * The runtime smoke check's wrangler config (same entrypoint, assets and flags
 * as the deploy), minified like Alchemy's bundle (alchemy.run.ts `bundle.minify`).
 */
export function webDryRunConfig(input: { webDir: string; compatibilityDate: string }) {
  return { ...buildSmokeConfig(input), name: "dirework-web-budget", minify: true };
}

function measureWeb(repoRoot: string, webDir: string): number {
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
    return parseGzipKib(result.stdout);
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

  const sizes = { api: gzipKib(readFileSync(apiBundle)), web: measureWeb(repoRoot, webDir) };
  for (const [name, kib] of Object.entries(sizes)) {
    console.log(
      `${name}: ${kib.toFixed(2)} KiB gzip (budget ${WORKER_BUDGET_KIB} KiB, free-plan cap ${FREE_PLAN_WORKER_CAP_KIB} KiB)`,
    );
  }

  const over = overBudget(sizes, WORKER_BUDGET_KIB);
  if (over.length > 0) {
    console.error(
      `Worker bundle budget exceeded: ${over.join(", ")}. Trim the bundle, or raise WORKER_BUDGET_KIB in packages/infra/bundle-budget.ts with a reason.`,
    );
    process.exit(1);
  }
  console.log("Worker bundle budget check passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
