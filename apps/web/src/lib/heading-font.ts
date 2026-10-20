// Montserrat, the heading face (`--font-heading` in index.css). It is above the fold on every
// landing and dashboard view, so it is preloaded; but next/font emits that preload for the
// routes whose module graph includes this file, so it is imported ONLY by the (app) layout —
// never by the root layout, and not by the (bot) or (overlay) layouts, whose pages render in
// other faces — so an OBS overlay or bot console never downloads it.

import { Montserrat } from "next/font/google";

export const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  preload: true,
});

/**
 * Dialogs, menus and selects portal to <body>, outside the (app) layout's wrapper element, so
 * the layout publishes the variable on body with this rule — rendered from that layout, never
 * the root, which keeps the preload scoped. next/font's hashed family name is only known here,
 * so the rule is built from `montserrat.style`.
 */
export const headingFontBodyCss = `body{--font-montserrat:${montserrat.style.fontFamily}}`;
