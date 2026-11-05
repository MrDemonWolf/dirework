// Writes the install manifest (src/lib/web-manifest.ts) to public/manifest.webmanifest, a
// static asset Workers Static Assets serve with the _headers lifetime instead of a Next
// metadata route the Worker answers on every fetch. The file is committed, so `next dev`
// serves it too; manifest.test.ts fails when it no longer matches the source (a token or
// icon change), and this script brings it back in line.
//
//   bun run manifest
import { writeFileSync } from "node:fs";
import path from "node:path";

import { webManifest } from "../src/lib/web-manifest";

/** Where the manifest is written: public/, which the build copies into the static assets. */
export const MANIFEST_FILE = path.join(import.meta.dirname, "../public/manifest.webmanifest");

/** The manifest as the exact text committed to public/. */
export function renderManifest(): string {
  return `${JSON.stringify(webManifest(), null, 2)}\n`;
}

if (import.meta.main) {
  writeFileSync(MANIFEST_FILE, renderManifest());
  console.log(`Wrote ${path.relative(process.cwd(), MANIFEST_FILE)}`);
}
