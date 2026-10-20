// Montserrat, the heading face (`--font-heading` in index.css). It is above the fold on every
// landing and dashboard view, so it is preloaded; but next/font emits that preload for the
// routes whose module graph includes this file, so it is imported ONLY by the (app) and (bot)
// layouts, never by the root layout, and an OBS overlay never downloads it.

import { Montserrat } from "next/font/google";

export const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  preload: true,
});
