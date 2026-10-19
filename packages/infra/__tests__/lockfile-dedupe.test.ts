import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../..", import.meta.url).pathname;

/**
 * Packages whose types cross package boundaries, so a second (nested) copy in
 * bun.lock breaks type checking even though every range is satisfied. A
 * better-auth bump once lifted the root zod to 4.6 while fumadocs-mdx kept a
 * nested 4.4: the docs' frontmatter schema types no longer matched
 * fumadocs-core's and `tsc` failed with "Property 'body' does not exist on
 * type 'PageData'". Bun keeps an existing nested entry instead of deduping,
 * so the fix is to delete it from bun.lock and reinstall with Bun 1.3.14.
 */
const SINGLE_COPY = ["zod"];

describe("bun.lock", () => {
  it.each(SINGLE_COPY)("resolves exactly one copy of %s", (name) => {
    const lock = readFileSync(`${repoRoot}/bun.lock`, "utf8");
    const nested = [...lock.matchAll(new RegExp(`^\\s+"([^"]+/${name})": \\["${name}@`, "gm"))].map(
      ([, key]) => key,
    );
    expect(nested).toEqual([]);
    expect(lock).toMatch(new RegExp(`^\\s+"${name}": \\["${name}@`, "m"));
  });
});
