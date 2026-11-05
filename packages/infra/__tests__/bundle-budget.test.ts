import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  UNCOMPRESSED_LIMIT_KIB,
  WORKER_BUDGET_KIB,
  bundleSizes,
  parseUploadSizes,
  sizeFailures,
  webDryRunConfig,
} from "../bundle-budget";

const repoRoot = resolve(import.meta.dirname, "../../..");

describe("parseUploadSizes", () => {
  it("reads both sizes out of wrangler's upload summary", () => {
    const output =
      "Total Upload: 6623.49 KiB / gzip: 2116.84 KiB\nNo bindings found.\n--dry-run: exiting now.\n";
    expect(parseUploadSizes(output)).toEqual({ rawKib: 6623.49, gzipKib: 2116.84 });
  });

  it("reads the report when wrangler colors it, as it does past 70% of the limit", () => {
    const output = "Total Upload: \u001b[33m48000.00 KiB / gzip: 15000.00 KiB\u001b[39m\n";
    expect(parseUploadSizes(output)).toEqual({ rawKib: 48000, gzipKib: 15000 });
  });

  it("refuses output without the upload line rather than passing a bundle it never measured", () => {
    expect(() => parseUploadSizes("✘ [ERROR] Build failed with 1 error")).toThrow(/upload size/);
  });
});

describe("bundleSizes", () => {
  it("reports the raw and compressed size in KiB, to the two decimals wrangler prints", () => {
    // A MiB of zeros: exactly 1024 KiB raw, about a KiB compressed.
    const { rawKib, gzipKib } = bundleSizes(new Uint8Array(1024 * 1024));
    expect(rawKib).toBe(1024);
    expect(gzipKib).toBeGreaterThan(0);
    expect(gzipKib).toBeLessThan(2);
    expect(gzipKib).toBe(Number(gzipKib.toFixed(2)));
  });
});

describe("sizeFailures", () => {
  const today = {
    api: { rawKib: 3074.46, gzipKib: 548.36 },
    web: { rawKib: 4846.29, gzipKib: 1457.25 },
  };

  it("passes workers inside Cloudflare's limit and the budget", () => {
    expect(sizeFailures(today)).toEqual([]);
  });

  it("flags a raw size over Cloudflare's 64 MiB limit, even when its gzip size fits the budget", () => {
    const failures = sizeFailures({ ...today, web: { rawKib: 65536.01, gzipKib: 1457.25 } });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^web: 65536\.01 KiB uncompressed is over Cloudflare's 65536 KiB/);
  });

  it("flags a raw size over the limit however high the budget is raised", () => {
    const failures = sizeFailures({ web: { rawKib: 70000, gzipKib: 20000 } }, 100_000);
    expect(failures).toEqual([expect.stringMatching(/^web: .*uncompressed/)]);
  });

  it("names only the workers over the gzip budget", () => {
    expect(sizeFailures({ ...today, web: { rawKib: 8000, gzipKib: 2560.01 } }, 2560)).toEqual([
      expect.stringMatching(/^web: 2560\.01 KiB gzip is over the 2560 KiB budget/),
    ]);
    expect(
      sizeFailures(
        { api: { rawKib: 8000, gzipKib: 2561 }, web: { rawKib: 8000, gzipKib: 2561 } },
        2560,
      ),
    ).toHaveLength(2);
  });

  it("treats a size exactly at the limit or the budget as within it", () => {
    expect(
      sizeFailures({ web: { rawKib: UNCOMPRESSED_LIMIT_KIB, gzipKib: WORKER_BUDGET_KIB } }),
    ).toEqual([]);
  });
});

describe("WORKER_BUDGET_KIB", () => {
  it("is low enough that next/og's renderer could not come back unnoticed", () => {
    // Web measured 1457 KiB gzip once next/og left the Worker (2026-11); its renderer
    // (resvg + yoga wasm, a font, Satori) is about 760 KiB gzip on its own.
    expect(WORKER_BUDGET_KIB).toBeLessThan(1457 + 760);
  });

  // The docs restate the gate. They must name the same ratchet, and Cloudflare's real
  // limit rather than the 3 MiB compressed cap it removed on 2026-09-04.
  it.each([
    "AGENTS.md",
    ".github/workflows/verify.yml",
    "apps/fumadocs/content/docs/deployment.mdx",
  ])("%s states the ratchet and the 64 MiB limit, not the removed compressed cap", (file) => {
    const text = readFileSync(`${repoRoot}/${file}`, "utf8");
    expect(text).toContain(`${WORKER_BUDGET_KIB} KiB`);
    expect(text).toContain("64 MiB");
    expect(text).not.toMatch(/3 MiB compressed|\b3072 KiB/);
  });
});

describe("webDryRunConfig", () => {
  it("measures the smoke check's bundle, minified the way Alchemy uploads it", () => {
    const config = webDryRunConfig({ webDir: "/repo/apps/web", compatibilityDate: "2026-04-24" });

    expect(config.main).toBe("/repo/apps/web/.open-next/worker.js");
    expect(config.compatibility_date).toBe("2026-04-24");
    expect(config.compatibility_flags).toEqual(["nodejs_compat", "global_fetch_strictly_public"]);
    expect(config.minify).toBe(true);
  });
});
