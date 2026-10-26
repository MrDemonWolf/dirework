import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "../../app/(bot)/bot-console.css"), "utf8");

describe("bot console stylesheet", () => {
  // Plain CSS skips the token-bypass check on class names, so hold it to the tokens here.
  it("takes every font size and letter spacing from a design token", () => {
    const declarations = css.match(/(?:font-size|letter-spacing):[^;}]+/g) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    expect(declarations.filter((decl) => !/:\s*var\(--(?:text|tracking)-/.test(decl))).toEqual([]);
  });

  // Container widths too: a shared layout-token change must reach this surface. Media
  // query breakpoints are the only place a 3-digit pixel length may appear.
  it("takes container widths from a design token", () => {
    const rules = css.replace(/@media[^{]+\{/g, "");
    expect(rules.match(/\b\d{3,}px\b/g) ?? []).toEqual([]);
    expect(rules).toContain("var(--container-md");
  });
});
