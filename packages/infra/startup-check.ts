/**
 * Worker startup check, run by verify.yml after `build:worker` and before the
 * runtime smoke check (`node ./node_modules/.bin/tsx startup-check.ts` from
 * packages/infra).
 *
 * Cloudflare gives a Worker 1 s of CPU, on every plan, to parse and run its global
 * scope (the code outside its handlers), and refuses an upload past it ("Script
 * startup exceeded CPU time limit", error 10021) after the deploy has already
 * applied the D1 migrations (https://developers.cloudflare.com/workers/platform/limits/).
 * `wrangler check startup` profiles that phase locally in workerd, with no
 * account or secret. This prints its CPU time for both workers (`Active`: idle
 * excluded, garbage collection included), adds it to the job summary, and fails
 * only above STARTUP_FAIL_MS.
 *
 * Each worker is bundled into an upload file (`wrangler deploy --dry-run
 * --outfile`), the same bundle bundle-budget.ts measures, and profiled from it:
 * - api: the server's `build` script flags (apps/server/package.json).
 * - web: webDryRunConfig, the smoke check's config minified like Alchemy's upload.
 *
 * The pure parts are unit-tested; main() runs only when this file is the
 * entrypoint.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

import { webDryRunConfig } from "./bundle-budget";
import { COMPATIBILITY_DATE } from "./deploy-config";

/** Cloudflare's startup limit: 1 s of CPU for the global scope, on every plan. */
export const STARTUP_LIMIT_MS = 1000;

/**
 * Fail above half the limit. The profile runs on the CI runner's CPU, not
 * Cloudflare's, and a busy machine reads slow (time the thread spends preempted
 * still counts as active): the margin keeps that noise from failing a run, while
 * a real regression still trips it with room to react. Measured in 2026-11 on a
 * heavily loaded laptop: api 86–195 ms, web 33–51 ms.
 */
export const STARTUP_FAIL_MS = 500;

/** The startup CPU time from `wrangler check startup`'s `Active: 40.2 ms (…)` line. */
export function parseStartupCpuMs(output: string): number {
  const match = /Active: ([\d.]+) ms/.exec(stripVTControlCharacters(output));
  if (!match) throw new Error("wrangler check startup did not report a startup CPU time");
  return Number(match[1]);
}

/** One line per worker over STARTUP_FAIL_MS. A time exactly at it passes. */
export function startupFailures(times: Record<string, number>): string[] {
  return Object.entries(times)
    .filter(([, ms]) => ms > STARTUP_FAIL_MS)
    .map(
      ([name, ms]) =>
        `${name}: ${ms} ms of startup CPU is over ${STARTUP_FAIL_MS} ms (Cloudflare's limit is ${STARTUP_LIMIT_MS} ms)`,
    );
}

/** The Markdown this check appends to $GITHUB_STEP_SUMMARY. */
export function startupSummary(times: Record<string, number>): string {
  return [
    "### Worker startup",
    "",
    `Startup CPU time from a local \`wrangler check startup\` profile, on the runner's CPU. The check fails above ${STARTUP_FAIL_MS} ms; Cloudflare's limit is ${STARTUP_LIMIT_MS} ms.`,
    "",
    "| Worker | Startup CPU | Result |",
    "| --- | ---: | --- |",
    ...Object.entries(times).map(
      ([name, ms]) =>
        `| ${name} | ${ms.toFixed(1)} ms | ${ms > STARTUP_FAIL_MS ? `over ${STARTUP_FAIL_MS} ms` : "ok"} |`,
    ),
    "",
  ].join("\n");
}

/**
 * The api's dry run: the server's `build` script, run in apps/server, writing one
 * upload file instead of a directory.
 */
export function apiDryRunArgs(outfile: string): string[] {
  return [
    "deploy",
    "src/index.ts",
    "--dry-run",
    "--name",
    "dirework-api",
    "--compatibility-date",
    COMPATIBILITY_DATE,
    "--compatibility-flag",
    "nodejs_compat",
    "--outfile",
    outfile,
  ];
}

/** Run wrangler and return its output; throw with the tail of it on failure. */
function runWrangler(bin: string, args: string[], cwd: string): string {
  const result = spawnSync(bin, args, {
    cwd,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    encoding: "utf8",
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) {
    const tail = output.split("\n").slice(-30).join("\n");
    throw new Error(`wrangler ${args.slice(0, 2).join(" ")} exited ${result.status}\n${tail}`);
  }
  return output;
}

/** Bundle one worker into an upload file, then profile its startup from that file. */
function measureStartup(
  bin: string,
  dir: string,
  name: string,
  cwd: string,
  dryRunArgs: (outfile: string) => string[],
): number {
  const bundle = path.join(dir, `${name}.bundle`);
  runWrangler(bin, dryRunArgs(bundle), cwd);
  // Profiled from the temp dir: no wrangler config to pick up, and wrangler's
  // scratch files go with it.
  const profile = path.join(dir, `${name}.cpuprofile`);
  return parseStartupCpuMs(
    runWrangler(bin, ["check", "startup", "--worker", bundle, "--outfile", profile], dir),
  );
}

function main(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const webDir = path.join(repoRoot, "apps/web");
  if (!existsSync(path.join(webDir, ".open-next/worker.js"))) {
    console.error(
      "No web bundle at apps/web/.open-next. Run `bun run build:worker` in apps/web first (verify.yml does, before this step).",
    );
    process.exit(1);
  }

  const bin = path.join(webDir, "node_modules/.bin/wrangler");
  const dir = mkdtempSync(path.join(tmpdir(), "dirework-startup-"));
  let keepProfiles = false;
  try {
    const webConfig = path.join(dir, "wrangler.json");
    writeFileSync(
      webConfig,
      JSON.stringify(webDryRunConfig({ webDir, compatibilityDate: COMPATIBILITY_DATE }), null, 2),
    );
    const times = {
      api: measureStartup(bin, dir, "api", path.join(repoRoot, "apps/server"), apiDryRunArgs),
      web: measureStartup(bin, dir, "web", webDir, (outfile) => [
        "deploy",
        "--dry-run",
        "--outfile",
        outfile,
        "-c",
        webConfig,
      ]),
    };
    for (const [name, ms] of Object.entries(times)) {
      console.log(
        `${name}: ${ms.toFixed(1)} ms startup CPU (fails above ${STARTUP_FAIL_MS} ms; Cloudflare's limit ${STARTUP_LIMIT_MS} ms)`,
      );
    }
    // Written before the verdict, so a failing run still records its numbers.
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) appendFileSync(summaryFile, startupSummary(times));

    const failures = startupFailures(times);
    if (failures.length > 0) {
      keepProfiles = true;
      console.error(
        `Worker startup check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\nMove work out of the global scope (into the handlers, or behind a dynamic import). The CPU profiles are in ${dir}: open one in Chrome DevTools (Performance) or VS Code to see what runs at startup.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("Worker startup check passed.");
  } finally {
    if (!keepProfiles) rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
