// Web app manifest: the source of the static public/manifest.webmanifest, which
// `bun run manifest` (scripts/write-manifest.ts) writes and manifest.test.ts holds to this
// object. A static asset, not a Next metadata route: those answer every fetch through the
// Worker with max-age=0 and no validator, while Workers Static Assets serve public/ for
// free with the _headers lifetime. It makes the dashboard installable to a phone's home
// screen. There is deliberately no service worker:
// installability doesn't need one, and an offline copy of a live dashboard would only show
// stale timer and task state. Only the (app) layout links it, so OBS overlays and the bot
// console never fetch it. Its colours are the dark `--background` as hex, generated from
// design-system/tokens.json into tokens.generated.ts; after a token change, run
// `bun run tokens` and then `bun run manifest`.

import type { MetadataRoute } from "next";

import { SCHEME_HEX } from "@/tokens.generated";

export function webManifest(): MetadataRoute.Manifest {
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
