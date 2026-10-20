// Spawn helpers shared by boot-api.ts and boot-web.ts: refuse a busy port, run this
// package's wrangler, forward signals, and exit with the child's code so Playwright's
// webServer teardown stops workerd too.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

import { readCompatibilityDate } from "../../../apps/web/scripts/smoke-worker.mjs";

export const repoRoot = path.resolve(import.meta.dirname, "../../..");

const wranglerBin = path.join(repoRoot, "packages/e2e/node_modules/.bin/wrangler");
const env = { ...process.env, WRANGLER_SEND_METRICS: "false" };

/** The one compatibility date both workers deploy with (packages/infra/deploy-config.ts). */
export function compatibilityDate(): string {
  const date: string | undefined = readCompatibilityDate(
    readFileSync(path.join(repoRoot, "packages/infra/deploy-config.ts"), "utf8"),
  );
  if (!date) throw new Error("COMPATIBILITY_DATE not found in packages/infra/deploy-config.ts");
  return date;
}

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}

/**
 * Fail before booting if anything already listens on the port, on either loopback
 * address. A `bun run dev` left on 3000 would otherwise answer the browser's
 * `localhost` requests (which may resolve to ::1) while the probes on 127.0.0.1 pass,
 * and every spec would fail against the wrong server with no hint why.
 */
export async function assertPortFree(port: number, what: string): Promise<void> {
  for (const host of ["127.0.0.1", "::1"]) {
    if (!(await canBind(port, host))) {
      throw new Error(
        `${what}: port ${port} is already in use on ${host}. Stop whatever is on it (a \`bun run dev\`?) or set E2E_API_PORT / E2E_WEB_PORT — see packages/e2e/src/env.ts.`,
      );
    }
  }
}

/** Run a one-shot wrangler command (migrations) and throw on failure. */
export function runWrangler(args: string[], cwd: string): void {
  const result = spawnSync(wranglerBin, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.slice(0, 3).join(" ")} failed with status ${result.status}`);
  }
}

/**
 * Start `wrangler dev` on loopback and keep this process alive as its proxy: Playwright
 * stops the webServer command, which forwards the signal to wrangler and so to workerd.
 */
export function devWrangler(args: string[], cwd: string): void {
  const child = spawn(
    wranglerBin,
    ["dev", ...args, "--ip", "127.0.0.1", "--show-interactive-dev-session=false"],
    { cwd, env, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code) => process.exit(code ?? 1));
}
