// The dashboard's body and mono typefaces, applied to <body> by the root layout. Every route
// shares that layout, overlays included, and overlays render their own configured faces from
// public/fonts, so these are NOT preloaded: they load on first use, and the size-adjusted
// fallback next/font generates keeps the swap from shifting layout. The heading face lives
// in heading-font.ts so only the routes that use it preload it.
//
// The files are self-hosted in packages/fonts (downloaded once by scripts/fetch-fonts.ts and
// committed), so a build never calls Google Fonts. next/font/local needs literal paths,
// relative to this file.

import localFont from "next/font/local";

export const plexSans = localFont({
  variable: "--font-plex-sans",
  // Variable font: one file covers weights 400–700.
  src: [
    { path: "../../../../packages/fonts/files/ibm-plex-sans-400_700.woff2", weight: "400 700" },
  ],
  display: "swap",
  preload: false,
});

export const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "../../../../packages/fonts/files/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "../../../../packages/fonts/files/ibm-plex-mono-500.woff2", weight: "500" },
    { path: "../../../../packages/fonts/files/ibm-plex-mono-600.woff2", weight: "600" },
  ],
  display: "swap",
  preload: false,
});
