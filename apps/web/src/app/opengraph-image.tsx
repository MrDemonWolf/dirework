// Default social share card (Next.js `opengraph-image` file convention at the app root, so every
// route inherits it). Prerendered once at build and served from OpenNext's static-assets cache
// rather than rendered per request. The card itself is `@dirework/overlay-kit/share-card`, which
// the docs site's opengraph-image renders too.

import { ImageResponse } from "next/og";

import { SHARE_CARD_ALT, SHARE_CARD_SIZE, ShareCard } from "@dirework/overlay-kit/share-card";

/** Alt text Next.js emits as `og:image:alt`. */
export const alt = SHARE_CARD_ALT;
/** The standard 1.91:1 Open Graph card size; Next.js emits it as og:image width/height. */
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

/** Renders the shared card with `next/og` (Satori). */
export default function OGImage() {
  return new ImageResponse(<ShareCard />, size);
}
