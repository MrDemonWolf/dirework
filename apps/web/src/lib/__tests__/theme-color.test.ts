import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SCHEME_HEX } from "@/tokens.generated";

import { themeColorFor } from "../theme-color";

describe("themeColorFor", () => {
  it("tints the browser bar with the app's resolved theme, not the OS's", () => {
    expect(themeColorFor("dark")).toBe(SCHEME_HEX.dark.background);
    expect(themeColorFor("light")).toBe(SCHEME_HEX.light.background);
  });

  it("treats a stale custom class as the light palette it renders with", () => {
    expect(themeColorFor("blue")).toBe(SCHEME_HEX.light.background);
  });

  it("leaves the SSR media-query tags alone before next-themes resolves", () => {
    expect(themeColorFor(undefined)).toBeNull();
  });

  it("is mounted by the (app) layout", () => {
    const layout = readFileSync(path.join(__dirname, "../../app/(app)/layout.tsx"), "utf8");
    expect(layout).toContain("<ThemeColorSync />");
  });
});
