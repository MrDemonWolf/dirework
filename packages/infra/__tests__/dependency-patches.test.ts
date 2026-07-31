import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Expand = ((pattern: string, options?: { max?: number; maxLength?: number }) => string[]) & {
  expand: Expand;
  EXPANSION_MAX_LENGTH: number;
};

const require = createRequire(import.meta.url);
const expand = require("brace-expansion") as Expand;

describe("locally patched dependencies", () => {
  it("keeps the legacy brace-expansion export while bounding total output length", () => {
    expect(expand.expand).toBe(expand);
    expect(expand.EXPANSION_MAX_LENGTH).toBe(4_000_000);

    const output = expand("{a,b}".repeat(12), { maxLength: 100 });
    expect(output.length).toBeGreaterThan(0);
    expect(output.reduce((total, value) => total + value.length, 0)).toBeLessThanOrEqual(100);
  });

  it("keeps the audit exception scoped to reviewed brace-expansion versions", () => {
    const lockfile = readFileSync(resolve(import.meta.dirname, "../../../bun.lock"), "utf8");
    const versions = [
      ...new Set(
        [...lockfile.matchAll(/brace-expansion@(\d+\.\d+\.\d+)/g)].map((match) => match[1]),
      ),
    ].sort();

    expect(versions).toEqual(["2.1.2", "5.0.9"]);
  });
});
