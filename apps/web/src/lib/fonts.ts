// The dashboard's body and mono typefaces, applied to <body> by the root layout. Every route
// shares that layout, overlays included, and overlays render their own configured faces from
// public/fonts, so these are NOT preloaded: they load on first use, and the size-adjusted
// fallback next/font generates keeps the swap from shifting layout. The heading face lives
// in heading-font.ts so only the routes that use it preload it.

import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

export const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});
