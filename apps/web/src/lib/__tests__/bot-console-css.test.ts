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
});
