#!/usr/bin/env bun
/**
 * Dirework design token generator.
 *
 * Reads `design-system/tokens.json` and emits platform-specific outputs:
 *   - CSS → apps/fumadocs/src/app/tokens.generated.css   (docs site --ds-* vars)
 *   - CSS → apps/web/src/tokens.generated.css            (web app --ds-* vars)
 *   - TS  → apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts
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

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

type Dict = Record<string, string>;

// ── CSS ───────────────────────────────────────────────────────────────────
function generateCSS(): string {
  const banner = `/*\n * ${BANNER_LINES.join("\n * ")}\n */\n`;
  const lines: string[] = [banner, ":root {"];

  for (const [k, v] of Object.entries(tokens.color.brand as Dict))
    lines.push(`  --ds-color-brand-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.semantic as Dict))
    lines.push(`  --ds-color-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.phase as Dict))
    lines.push(`  --ds-color-phase-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.surface.light as Dict))
    lines.push(`  --ds-color-surface-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.text.light as Dict))
    lines.push(`  --ds-color-text-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.partner as Dict))
    lines.push(`  --ds-color-partner-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.font.family as Dict))
    lines.push(`  --ds-font-family-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.font.size as Record<string, number>))
    lines.push(`  --ds-font-size-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(tokens.font.weight as Record<string, number>))
    lines.push(`  --ds-font-weight-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.space as Record<string, number>))
    lines.push(`  --ds-space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(tokens.radius as Record<string, number>)) {
    const out = k === "pill" ? "9999px" : `${v}px`;
    lines.push(`  --ds-radius-${k}: ${out};`);
  }
  for (const [k, v] of Object.entries(tokens.motion.duration as Record<string, number>))
    lines.push(`  --ds-motion-duration-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(tokens.motion.easing as Dict))
    lines.push(`  --ds-motion-easing-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.shadow as Dict))
    lines.push(`  --ds-shadow-${k}: ${v};`);
  lines.push("}", "");

  lines.push('.dark, [data-theme="dark"] {');
  for (const [k, v] of Object.entries(tokens.color.brandDark as Dict))
    lines.push(`  --ds-color-brand-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.surface.dark as Dict))
    lines.push(`  --ds-color-surface-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.color.text.dark as Dict))
    lines.push(`  --ds-color-text-${k}: ${v};`);
  lines.push("}", "");

  return lines.join("\n");
}

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
    `export const SQUIRCLE_RADIUS = ${tokens.overlay.squircleRadius ?? 0.22};`,
    "",
  ].join("\n");
}

// ── Emit ──────────────────────────────────────────────────────────────────
console.log("Generating Dirework design tokens…");
const css = generateCSS();
write("apps/fumadocs/src/app/tokens.generated.css", css);
write("apps/web/src/tokens.generated.css", css);
write(
  "apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts",
  generateOverlayThemes(),
);
console.log("Done.");
