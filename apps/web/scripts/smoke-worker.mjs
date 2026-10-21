// Boot the built web worker (the OpenNext output from `build:worker`) in local
// workerd via `wrangler dev`, and request routes that render without the api
// worker. `next build` and the OpenNext bundle can both succeed while the
// worker throws at runtime: Next 16.4 under OpenNext 1.20.9 built cleanly,
// then failed every request in production (Cloudflare 1101) with
// "Unexpected loadManifest(/.next/server/preview-props.json) call!". Only
// running the bundle catches that, so verify.yml runs this after the build.
//
// Routes that SSR the session (/, /setup, /dashboard) need the api worker and
// are deliberately not checked: without it they render Next's 500 page.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Routes that must answer 200 from the bundle alone (no api, no D1). */
export const SMOKE_ROUTES = [
  "/api/version",
  "/overlay/t/smoke",
  "/overlay/l/smoke",
  "/bot/smoke",
  "/manifest.webmanifest",
];

/**
 * Extra checks for the install manifest (app/manifest.ts): a browser ignores a manifest
 * served with the wrong type or one that isn't standalone, so a 200 alone isn't enough.
 * Returns the failure messages (empty when it passes).
 */
export async function checkManifestResponse(res) {
  const failures = [];
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("manifest+json")) failures.push(`manifest content-type is "${type}"`);
  try {
    const body = await res.json();
    if (body.display !== "standalone") failures.push(`manifest display is "${body.display}"`);
  } catch {
    failures.push("manifest body is not JSON");
  }
  return failures;
}

/**
 * Flags Alchemy's Nextjs resource always deploys the web worker with
 * (alchemy/lib/cloudflare/next.js). The smoke run must match them, or it
 * tests a different runtime than production.
 */
export const WEB_COMPATIBILITY_FLAGS = ["nodejs_compat", "global_fetch_strictly_public"];

/** Read COMPATIBILITY_DATE out of packages/infra/deploy-config.ts (the one pin both workers use). */
export function readCompatibilityDate(source) {
  const match = /export const COMPATIBILITY_DATE = "(\d{4}-\d{2}-\d{2})"/.exec(source);
  if (!match) throw new Error("COMPATIBILITY_DATE not found in deploy-config.ts");
  return match[1];
}

/**
 * The wrangler config for the smoke run: the same entrypoint, static assets
 * and runtime flags Alchemy deploys. The vars are placeholders; the checked
 * routes never call the api, and NEXT_PUBLIC_SERVER_URL points at a closed
 * port so any accidental api call fails fast instead of leaving the machine.
 */
export function buildSmokeConfig({ webDir, compatibilityDate }) {
  return {
    name: "dirework-web-smoke",
    main: path.join(webDir, ".open-next/worker.js"),
    compatibility_date: compatibilityDate,
    compatibility_flags: WEB_COMPATIBILITY_FLAGS,
    assets: { directory: path.join(webDir, ".open-next/assets"), binding: "ASSETS" },
    // next/og's compiled default font (Geist-Regular.ttf.bin); Alchemy's bundle
    // config adds the same ".bin" binary loader.
    rules: [{ type: "Data", globs: ["**/*.bin"], fallthrough: true }],
    // wrangler's esbuild pass keeps function names by default, wrapping them in a
    // `__name(fn, "fn")` helper. next-themes ships its anti-flash script as
    // `fn.toString()`, so that helper call leaked into the page and threw
    // `__name is not defined` in the browser on every load. Alchemy's deploy bundle
    // (minify, no keepNames) never adds it; match it here (the e2e boot reuses this).
    keep_names: false,
    vars: {
      BETTER_AUTH_URL: "http://127.0.0.1",
      NEXT_PUBLIC_SERVER_URL: "http://127.0.0.1:9",
      PROXY_SECRET: "smoke-check-placeholder-secret-0000000000",
    },
  };
}

async function waitForServer(base, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited early (${child.exitCode})`);
    try {
      await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(5_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`wrangler dev did not start within ${timeoutMs / 1000}s`);
}

async function main() {
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const deployConfig = readFileSync(
    path.resolve(webDir, "../../packages/infra/deploy-config.ts"),
    "utf8",
  );
  const config = buildSmokeConfig({
    webDir,
    compatibilityDate: readCompatibilityDate(deployConfig),
  });

  const dir = mkdtempSync(path.join(tmpdir(), "dirework-smoke-"));
  const configPath = path.join(dir, "wrangler.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const port = process.env.SMOKE_PORT ?? "8790";
  const base = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(
    path.join(webDir, "node_modules/.bin/wrangler"),
    [
      "dev",
      "-c",
      configPath,
      "--port",
      port,
      "--ip",
      "127.0.0.1",
      "--show-interactive-dev-session=false",
    ],
    { cwd: webDir, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  const failures = [];
  try {
    await waitForServer(base, child, 90_000);
    for (const route of SMOKE_ROUTES) {
      const res = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(30_000) });
      console.log(`${res.status} ${route}`);
      if (res.status !== 200) failures.push(`${route} answered ${res.status}`);
      else if (route === "/manifest.webmanifest")
        failures.push(...(await checkManifestResponse(res)));
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    child.kill("SIGTERM");
    rmSync(dir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`Web worker smoke check failed:\n- ${failures.join("\n- ")}`);
    // The worker's own error (e.g. the loadManifest throw) is in wrangler's output.
    console.error(`\nwrangler dev output (tail):\n${output.split("\n").slice(-40).join("\n")}`);
    process.exit(1);
  }
  console.log("Web worker smoke check passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
