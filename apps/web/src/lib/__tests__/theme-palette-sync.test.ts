import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SQUIRCLE_RADIUS } from "@dirework/overlay-kit";

import { themePresets } from "../theme-presets";

/**
 * Drift guard between the two places the overlay theme palette lives:
 *
 *   1. design-system/tokens.json (`overlay.themes`) — feeds the docs-site
 *      theme gallery via the generated overlay-themes.generated.ts.
 *   2. apps/web/src/lib/theme-presets.ts — the real Theme Center presets
 *      (preview swatches + per-task username color).
 *
 * Generating theme-presets.ts from tokens.json was considered and rejected:
 * the presets carry far more data (full timer/task style trees) than
 * tokens.json holds, so codegen would be invasive. This test is the cheaper
 * sound option — if either side changes a palette value, CI fails here.
 */

interface TokenTheme {
  bg: string;
  accent: string;
  text: string;
  username: string;
}

const tokens = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../design-system/tokens.json", import.meta.url)),
    "utf8",
  ),
) as {
  overlay: {
    squircleRadius: number;
    defaultTheme: string;
    themes: Record<string, TokenTheme>;
  };
};

/** Hex comparison ignoring case — tokens.json is uppercase, presets lowercase. */
function norm(hex: string): string {
  return hex.toLowerCase();
}

describe("design-system tokens.json ↔ theme-presets.ts palette sync", () => {
  const tokenThemes = tokens.overlay.themes;

  it("defines the same theme names in both sources", () => {
    expect(themePresets.map((p) => p.name).sort()).toEqual(Object.keys(tokenThemes).sort());
  });

  for (const preset of themePresets) {
    describe(preset.name, () => {
      const tokenTheme = tokenThemes[preset.name];

      it("matches the preview palette (bg / accent / text)", () => {
        expect(tokenTheme).toBeDefined();
        expect(norm(preset.preview.bg)).toBe(norm(tokenTheme!.bg));
        expect(norm(preset.preview.accent)).toBe(norm(tokenTheme!.accent));
        expect(norm(preset.preview.text)).toBe(norm(tokenTheme!.text));
      });

      it("matches the task username color", () => {
        expect(norm(preset.taskStyles.task.usernameColor)).toBe(norm(tokenTheme!.username));
      });
    });
  }
});

describe("design-system tokens.json ↔ @dirework/overlay-kit", () => {
  it("squircleRadius matches the canonical SQUIRCLE_RADIUS constant", () => {
    expect(tokens.overlay.squircleRadius).toBe(SQUIRCLE_RADIUS);
  });
});
