import { ImageResponse } from "next/og";

import { SHARE_CARD_ALT, SHARE_CARD_SIZE, ShareCard } from "@dirework/overlay-kit/share-card";

// Branded default OG / Twitter card for the site home page and any page without its
// own image (Next emits it as both og:image and twitter:image). Per-doc pages override
// this via generateMetadata (og/docs route). The card itself is
// `@dirework/overlay-kit/share-card`, which the web app's opengraph-image renders too.
export const alt = SHARE_CARD_ALT;
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";
// Required for `output: export` (static GitHub Pages build) — pre-render at build.
export const dynamic = "force-static";

/** Renders the shared card with next/og (Satori). */
export default function OpengraphImage() {
  return new ImageResponse(<ShareCard />, size);
}
