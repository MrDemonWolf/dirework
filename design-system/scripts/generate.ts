#!/usr/bin/env bun
/**
 * Dirework design token generator.
 *
 * Reads `design-system/tokens.json` and emits platform-specific outputs:
 *   - TS → apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts
 *
 * The overlay palette in tokens.json is also mirrored by the web app's theme
 * presets (apps/web/src/lib/theme-presets.ts) — a unit test
 * (apps/web/src/lib/__tests__/theme-palette-sync.test.ts) fails CI on drift.
 * The squircle radius constant lives in @dirework/overlay-kit (same test
 * asserts tokens.json matches it).
 *
 * Idempotent: re-running produces identical files. CI may diff to detect drift.
 *   bun run tokens && git diff --exit-code
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const tokens = JSON.parse(
  readFileSync(resolve(ROOT, "design-system/tokens.json"), "utf8"),
);

const BANNER_LINES = [
  "Dirework Design System — GENERATED FILE. Do not edit by hand.",
  "Source: design-system/tokens.json",
  "Run `bun run tokens` to regenerate.",
];

function write(path: string, content: string) {
  const full = resolve(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log(`  ✓ ${path}`);
}

type Dict = Record<string, string>;

// ── Overlay themes TS (docs theme gallery) ─────────────────────────────────
function generateOverlayThemes(): string {
  const banner = `/*\n * ${BANNER_LINES.join("\n * ")}\n */`;
  const themes = tokens.overlay.themes as Record<string, Dict>;
  return [
    banner,
    "",
    `export const OVERLAY_THEMES = ${JSON.stringify(themes, null, 2)} as const;`,
    "",
    "export type OverlayThemeName = keyof typeof OVERLAY_THEMES;",
    "export type OverlayTheme = (typeof OVERLAY_THEMES)[OverlayThemeName];",
    "",
    `export const OVERLAY_THEME_NAMES = ${JSON.stringify(
      Object.keys(themes),
    )} as OverlayThemeName[];`,
    "",
    `export const DEFAULT_OVERLAY_THEME: OverlayThemeName = ${JSON.stringify(
      tokens.overlay.defaultTheme ?? Object.keys(themes)[0],
    )};`,
    "",
  ].join("\n");
}

// ── Emit ──────────────────────────────────────────────────────────────────
console.log("Generating Dirework design tokens…");
write(
  "apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts",
  generateOverlayThemes(),
);
console.log("Done.");
