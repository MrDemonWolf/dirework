import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Expand = (pattern: string, options?: { max?: number; maxLength?: number }) => string[];

const require = createRequire(import.meta.url);
const expand = require("brace-expansion") as Expand;

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
        [...lockfile.matchAll(/brace-expansion@(\d+\.\d+\.\d+)/g)].map((match) => match[1]),
      ),
    ].sort();

    expect(versions).toEqual(["2.1.4", "5.0.9"]);
  });
});
