import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8");

it("reuses dynamic page segments for the 30-second query freshness window", () => {
  expect(read("../../../next.config.ts")).toMatch(
    /experimental:\s*\{\s*staleTimes:\s*\{\s*dynamic:\s*30(?:,|\s*\})/,
  );
  expect(read("../poll-intervals.ts")).toContain("QUERY_FRESH_MS = 30_000");
});
