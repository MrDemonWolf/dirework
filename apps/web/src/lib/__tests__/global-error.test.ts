import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GlobalError from "../../app/global-error";
import { THEME_INIT_SCRIPT } from "../theme-init";

const source = readFileSync(path.join(__dirname, "../../app/global-error.tsx"), "utf8");
const html = renderToString(
  createElement(GlobalError, { error: new Error("boom"), reset: () => {} }),
);

describe("global-error (the root-layout crash page)", () => {
  it("never spells the retired stone palette; colors come from tokens.generated", () => {
    for (const hex of ["#141210", "#e7e5e4", "#a8a29e", "#57534e"]) {
      expect(source.toLowerCase()).not.toContain(hex);
    }
    expect(source).toContain('from "@/tokens.generated"');
  });

  it("renders exactly one <title>", () => {
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("<title>DireWork hit an error</title>");
  });

  it("marks overlays and the bot widget before paint with the root layout's own script", () => {
    // The same bytes as app/layout.tsx's <head> script, so the surface rule can't drift.
    expect(html).toContain(THEME_INIT_SCRIPT);
    expect(source).toContain("THEME_INIT_SCRIPT");
  });

  it("paints nothing on a marked surface: transparent canvas, notice only for screen readers", () => {
    const style = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
    expect(style).toMatch(/html\[data-surface="overlay"\] body\{background:transparent !important/);
    expect(style).toMatch(/html\[data-surface="overlay"\] main\{position:absolute/);
    expect(style).toMatch(/html\[data-surface="overlay"\] main button\{display:none/);
  });

  it("re-marks the surface on a client render and resets itself there", () => {
    expect(source).toContain("isTransparentSurface(location.pathname, location.search)");
    expect(source).toMatch(/setTimeout\(reset, RECOVER_AFTER_MS\)/);
  });
});
