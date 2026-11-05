import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pins ADR 0002: no Cache Components or Partial Prefetching while @opennextjs/cloudflare can't
// serve them and the incremental cache is the read-only static-assets cache, which has no
// "use cache" support. Turning either on means revisiting the ADR first.
const ADR = "docs/decisions/0002-rendering-and-caching.md";
const webRoot = path.join(__dirname, "../../..");
const nextConfig = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
const openNextConfig = readFileSync(path.join(webRoot, "open-next.config.ts"), "utf8");

describe("rendering and caching decision (ADR 0002)", () => {
  it("points at a decision record that exists", () => {
    expect(existsSync(path.join(webRoot, "../..", ADR)), ADR).toBe(true);
  });

  it("keeps Cache Components, PPR and Partial Prefetching off", () => {
    // The top-level Next 16 options plus the experimental names they replaced.
    const flags = [
      ...nextConfig.matchAll(/\b(cacheComponents|partialPrefetching|ppr|useCache|dynamicIO)\s*:/g),
    ].map((match) => match[1]);
    expect(flags, `revisit ${ADR} before enabling`).toEqual([]);
  });

  it("keeps the read-only static-assets incremental cache", () => {
    expect(openNextConfig).toContain(
      'from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"',
    );
    expect(openNextConfig).toContain("incrementalCache: staticAssetsIncrementalCache");
  });
});
