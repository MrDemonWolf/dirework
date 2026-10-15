import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Expand = (pattern: string, options?: { max?: number; maxLength?: number }) => string[];

const require = createRequire(import.meta.url);
const expand = require("brace-expansion") as Expand;

// Lowest patched release per major line. Any other major (e.g. 1.x) is unpatched.
const BRACE_EXPANSION_FLOORS: Record<number, [number, number]> = {
  2: [1, 7],
  5: [0, 12],
};

function isPatchedBraceExpansion(version: string): boolean {
  const [major = Number.NaN, minor = Number.NaN, patch = Number.NaN] = version
    .split(".")
    .map(Number);
  const floor = BRACE_EXPANSION_FLOORS[major];
  if (!floor) return false;
  const [floorMinor, floorPatch] = floor;
  return minor > floorMinor || (minor === floorMinor && patch >= floorPatch);
}

describe("dependency security remediations", () => {
  it("keeps the brace-expansion compatibility API while bounding total output length", () => {
    expect(expand("{a,b}")).toEqual(["a", "b"]);

    const output = expand("{a,b}".repeat(12), { maxLength: 100 });
    expect(output.length).toBeGreaterThan(0);
    expect(output.reduce((total, value) => total + value.length, 0)).toBeLessThanOrEqual(100);
  });

  it("resolves only patched brace-expansion versions", () => {
    const lockfile = readFileSync(resolve(import.meta.dirname, "../../../bun.lock"), "utf8");
    const versions = [
      ...new Set(
        [...lockfile.matchAll(/brace-expansion@(\d+\.\d+\.\d+)/g)].map((match) => match[1] ?? ""),
      ),
    ];

    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isPatchedBraceExpansion(version), `brace-expansion@${version}`).toBe(true);
    }
  });

  it("compares brace-expansion versions numerically against each major's floor", () => {
    expect(isPatchedBraceExpansion("2.1.7")).toBe(true);
    expect(isPatchedBraceExpansion("2.1.10")).toBe(true);
    expect(isPatchedBraceExpansion("5.0.12")).toBe(true);
    expect(isPatchedBraceExpansion("5.1.0")).toBe(true);
    expect(isPatchedBraceExpansion("2.1.6")).toBe(false);
    expect(isPatchedBraceExpansion("5.0.11")).toBe(false);
    expect(isPatchedBraceExpansion("1.1.12")).toBe(false);
    expect(isPatchedBraceExpansion("3.0.0")).toBe(false);
  });
});
