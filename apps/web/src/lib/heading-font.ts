// Montserrat, the heading face (`--font-heading` in index.css). It is above the fold on every
// landing and dashboard view, so it is preloaded; but next/font emits that preload for the
// routes whose module graph includes this file, so it is imported ONLY by the (app) layout —
// never by the root layout, and not by the (bot) or (overlay) layouts, whose pages render in
// other faces — so an OBS overlay or bot console never downloads it. Self-hosted in
// packages/fonts like the faces in fonts.ts, so a build never calls Google Fonts.

import localFont from "next/font/local";

export const montserrat = localFont({
  variable: "--font-montserrat",
  // Variable font, 400–800 (shared with the docs site); dashboard headings use 500–700.
  src: [{ path: "../../../../packages/fonts/files/montserrat-400_800.woff2", weight: "400 800" }],
  display: "swap",
  preload: true,
});

/**
 * Dialogs, menus and selects portal to <body>, outside the (app) layout's wrapper element, so
 * the layout publishes the variable on body with this rule — rendered from that layout, never
 * the root, which keeps the preload scoped. next/font's hashed family name is only known here,
 * so the rule is built from `montserrat.style`.
 */
export const headingFontBodyCss = `body{--font-montserrat:${montserrat.style.fontFamily}}`;
