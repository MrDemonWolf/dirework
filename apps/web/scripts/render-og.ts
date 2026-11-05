// Renders the social share card (`@dirework/overlay-kit/share-card`) to public/og.png at
// build time. `build` and `build:worker` run it first, so Workers Static Assets serve the
// card and no route imports next/og: its renderer (resvg and yoga wasm, a bundled font,
// Satori) cost the web Worker about 760 KiB gzip for a card no request ever rendered.
// The output is gitignored; the root layout's metadata points og:image and twitter:image
// at it (src/lib/og-image.ts).
//
//   bun run render-og
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";
import { createElement } from "react";

import { SHARE_CARD_SIZE, ShareCard } from "@dirework/overlay-kit/share-card";

import { OG_IMAGE_PATH } from "../src/lib/og-image";

/** Where the card is written: public/, which the build copies into the static assets. */
export const OG_IMAGE_FILE = path.join(import.meta.dirname, "../public", OG_IMAGE_PATH);

/** The card as PNG bytes, rendered by next/og (Satori + resvg) under Node or Bun. */
export async function renderOgPng(): Promise<Buffer> {
  const response = new ImageResponse(createElement(ShareCard), SHARE_CARD_SIZE);
  return Buffer.from(await response.arrayBuffer());
}

if (import.meta.main) {
  const png = await renderOgPng();
  mkdirSync(path.dirname(OG_IMAGE_FILE), { recursive: true });
  writeFileSync(OG_IMAGE_FILE, png);
  console.log(`Wrote ${path.relative(process.cwd(), OG_IMAGE_FILE)} (${png.byteLength} bytes)`);
}
