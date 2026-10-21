import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SMOKE_ROUTES,
  WEB_COMPATIBILITY_FLAGS,
  buildSmokeConfig,
  checkManifestResponse,
  readCompatibilityDate,
} from "../../../scripts/smoke-worker.mjs";

const repoRoot = path.resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

// The smoke run is only meaningful if it boots the worker the way production
// does; these pin it to the deploy's own sources so they can't drift apart.
describe("web worker smoke check", () => {
  it("reads the compatibility date both workers deploy with", () => {
    const date = readCompatibilityDate(read("packages/infra/deploy-config.ts"));
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(read("packages/infra/deploy-config.ts")).toContain(`"${date}"`);
  });

  it("uses every compatibility flag Alchemy's Nextjs resource deploys with", () => {
    // The alchemy the deploy runs: packages/infra's own dependency.
    const nextResource = read("packages/infra/node_modules/alchemy/lib/cloudflare/next.js");
    const block = /compatibilityFlags: \[([^\]]*)\]/.exec(nextResource)?.[1] ?? "";
    const deployed = [...block.matchAll(/"([a-z_]+)"/g)].map(([, flag]) => flag);
    expect(deployed.length).toBeGreaterThan(0);
    expect([...WEB_COMPATIBILITY_FLAGS].sort()).toEqual([...deployed].sort());
  });

  it("points the config at the OpenNext output and binds static assets", () => {
    const config = buildSmokeConfig({ webDir: "/w", compatibilityDate: "2026-01-01" });
    expect(config.main).toBe("/w/.open-next/worker.js");
    expect(config.assets).toEqual({ directory: "/w/.open-next/assets", binding: "ASSETS" });
    expect(config.compatibility_date).toBe("2026-01-01");
  });

  it("bundles without esbuild keepNames, like the deploy, so no __name helper leaks", () => {
    // next-themes inlines `fn.toString()` into the page; with keepNames that string
    // calls a `__name` helper the browser doesn't have (a pageerror on every load).
    const config = buildSmokeConfig({ webDir: "/w", compatibilityDate: "2026-01-01" });
    expect(config.keep_names).toBe(false);
    expect(read("packages/infra/alchemy.run.ts")).not.toMatch(/keepNames:\s*true/);
  });

  it("checks the install manifest's type and display mode, not just its status", async () => {
    expect(SMOKE_ROUTES).toContain("/manifest.webmanifest");
    const manifest = (type: string, body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": type } });
    expect(
      await checkManifestResponse(manifest("application/manifest+json", { display: "standalone" })),
    ).toEqual([]);
    expect(
      await checkManifestResponse(manifest("text/html", { display: "standalone" })),
    ).toHaveLength(1);
    expect(
      await checkManifestResponse(manifest("application/manifest+json", { display: "browser" })),
    ).toHaveLength(1);
  });

  it("only checks routes that render without the api worker", () => {
    expect(SMOKE_ROUTES).toContain("/api/version");
    for (const route of ["/", "/setup", "/dashboard"]) expect(SMOKE_ROUTES).not.toContain(route);
  });
});
