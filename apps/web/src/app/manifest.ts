// Web app manifest, served by Next at /manifest.webmanifest. It makes the dashboard
// installable to a phone's home screen. There is deliberately no service worker:
// installability doesn't need one, and an offline copy of a live dashboard would only show
// stale timer and task state. Only the (app) layout links it, so OBS overlays and the bot
// console never fetch it.

import type { MetadataRoute } from "next";

/** The dark theme's `--background` (oklch(0.155 0.004 286) in tokens.generated.css) as sRGB hex. */
export const DARK_BACKGROUND_HEX = "#0c0c0e";
/** The light theme's `--background` (oklch(0.985 0 0) in tokens.generated.css) as sRGB hex. */
export const LIGHT_BACKGROUND_HEX = "#fafafa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DireWork",
    short_name: "DireWork",
    description: "Pomodoro timer and task list for Twitch co-working streams.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: DARK_BACKGROUND_HEX,
    theme_color: DARK_BACKGROUND_HEX,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
