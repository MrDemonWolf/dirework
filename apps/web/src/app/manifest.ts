// Web app manifest, served by Next at /manifest.webmanifest. It makes the dashboard
// installable to a phone's home screen. There is deliberately no service worker:
// installability doesn't need one, and an offline copy of a live dashboard would only show
// stale timer and task state. Only the (app) layout links it, so OBS overlays and the bot
// console never fetch it. Its colours are the dark `--background` as hex, generated from
// design-system/tokens.json into tokens.generated.ts.

import type { MetadataRoute } from "next";

import { SCHEME_HEX } from "@/tokens.generated";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DireWork",
    short_name: "DireWork",
    description: "Pomodoro timer and task list for Twitch co-working streams.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: SCHEME_HEX.dark.background,
    theme_color: SCHEME_HEX.dark.background,
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
