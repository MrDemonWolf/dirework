import { describe, expect, it } from "vitest";

import {
  FREE_PLAN_WORKER_CAP_KIB,
  WORKER_BUDGET_KIB,
  gzipKib,
  overBudget,
  parseGzipKib,
  webDryRunConfig,
} from "../bundle-budget";

describe("parseGzipKib", () => {
  it("reads the compressed size out of wrangler's upload summary", () => {
    const output =
      "Total Upload: 2978.84 KiB / gzip: 524.77 KiB\nNo bindings found.\n--dry-run: exiting now.\n";
    expect(parseGzipKib(output)).toBe(524.77);
  });

  it("refuses output without a gzip line rather than passing a bundle it never measured", () => {
    expect(() => parseGzipKib("✘ [ERROR] Build failed with 1 error")).toThrow(/gzip/);
  });
});

describe("gzipKib", () => {
  it("reports the compressed size in KiB, to the two decimals wrangler prints", () => {
    // A MiB of zeros compresses to about a KiB.
    const kib = gzipKib(new Uint8Array(1024 * 1024));
    expect(kib).toBeGreaterThan(0);
    expect(kib).toBeLessThan(2);
    expect(kib).toBe(Number(kib.toFixed(2)));
  });
});

describe("overBudget", () => {
  it("names only the workers above the budget", () => {
    expect(overBudget({ api: 524.77, web: 1989.4 }, 2560)).toEqual([]);
    expect(overBudget({ api: 524.77, web: 2560.01 }, 2560)).toEqual(["web"]);
    expect(overBudget({ api: 2561, web: 2561 }, 2560)).toEqual(["api", "web"]);
  });

  it("treats a size exactly at the budget as within it", () => {
    expect(overBudget({ web: 2560 }, 2560)).toEqual([]);
  });
});

describe("WORKER_BUDGET_KIB", () => {
  it("leaves headroom under the free plan's compressed cap", () => {
    expect(WORKER_BUDGET_KIB).toBeLessThan(FREE_PLAN_WORKER_CAP_KIB);
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
