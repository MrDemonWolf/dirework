import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FONT_OPTIONS } from "../overlay-font-options";

const fontsCss = readFileSync(path.join(__dirname, "../../../public/fonts/fonts.css"), "utf8");

describe("self-hosted overlay fonts", () => {
  // Guards the picker ↔ public/fonts drift: adding a family to FONT_OPTIONS
  // without re-running `bun run fetch-fonts` would silently fall back again.
  it("ships an @font-face for every picker option", () => {
    for (const family of FONT_OPTIONS) {
      expect(fontsCss, `missing @font-face for "${family}"`).toContain(`font-family: "${family}";`);
    }
  });

  it("references only same-origin woff2 files", () => {
    const urls = [...fontsCss.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^\.\/[a-z0-9-]+-[0-9_ ]+\.woff2$/);
    }
  });
});
