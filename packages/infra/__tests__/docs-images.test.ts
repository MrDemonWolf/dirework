import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The docs site is a static export (GitHub Pages). An image a page imports is published once,
// content-hashed under /_next/static/media; everything in apps/fumadocs/public is published
// too, as-is, whether a page uses it or not. So the app screenshots live in
// src/assets/screenshots (imported, never public/, where they used to ship a second,
// unreferenced copy) as lossless WebP, which keeps them pixel-exact and 58% under the PNGs
// they replaced (339,031 → 140,604 B on /docs/features). `bun run screenshots:capture`
// (packages/e2e/screenshots/marketing.spec.ts) writes them.

const docsDir = resolve(import.meta.dirname, "../../../apps/fumadocs");
const SCREENSHOTS = join(docsDir, "src/assets/screenshots");
/** The largest lossless capture (theme-center, 1440×1000) is ~76 KiB; its PNG was ~179 KiB. */
const BUDGET_BYTES = 96 * 1024;
const IMAGE_IMPORT = /\bfrom\s+["']([^"']+\.(?:png|jpe?g|gif|webp|avif))["']/g;
const PNG_SCREENSHOT = /screenshots\/[\w.-]+\.png\b/;

function filesUnder(dir: string, extensions?: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => (extensions ? extensions.includes(extname(file)) : extname(file) !== ""))
    .map((file) => join(dir, file));
}

/** Every docs page source: the MDX content plus the app's routes, components and styles. */
const sources = [
  ...filesUnder(join(docsDir, "content"), [".mdx"]),
  ...filesUnder(join(docsDir, "src"), [".ts", ".tsx", ".mdx", ".css"]),
];

/** Where an import points: `@/` is src/ (tsconfig paths), anything else is file-relative. */
function resolveImport(from: string, specifier: string): string {
  return specifier.startsWith("@/")
    ? join(docsDir, "src", specifier.slice(2))
    : resolve(dirname(from), specifier);
}

/**
 * The RIFF chunks of a WebP file. The image is `VP8L` (lossless) or `VP8 ` (lossy); an
 * extended file starts with `VP8X` and carries the image in a later chunk.
 */
function webpChunks(file: string): string[] {
  const bytes = readFileSync(file);
  if (bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") {
    return [];
  }
  const chunks: string[] = [];
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    chunks.push(bytes.toString("latin1", offset, offset + 4));
    const size = bytes.readUInt32LE(offset + 4);
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

describe("docs screenshots", () => {
  it("are not published from public/ beside the hashed copy an import makes", () => {
    expect(existsSync(join(docsDir, "public/screenshots"))).toBe(false);
  });

  it("no docs page references a PNG screenshot", () => {
    const offenders = sources
      .filter((file) => PNG_SCREENSHOT.test(readFileSync(file, "utf8")))
      .map((file) => relative(docsDir, file));
    expect(offenders).toEqual([]);
  });

  it("every image a docs page imports is a WebP outside public/ that exists", () => {
    const imports = sources.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(IMAGE_IMPORT)].map(([, specifier = ""]) => ({
        page: relative(docsDir, file),
        image: relative(docsDir, resolveImport(file, specifier)),
      })),
    );
    // The features page and the docs home import screenshots; an empty scan proves nothing.
    expect(imports.length).toBeGreaterThan(0);
    for (const { page, image } of imports) {
      expect(image, `imported by ${page}`).toMatch(/\.webp$/);
      expect(image, `imported by ${page}`).not.toMatch(/^public\//);
      expect(existsSync(join(docsDir, image)), `${image}, imported by ${page}`).toBe(true);
    }
  });

  it("each screenshot is a lossless WebP within the size budget", () => {
    const shots = filesUnder(SCREENSHOTS).filter((file) => !file.endsWith("README.md"));
    expect(shots.length, `screenshots in ${relative(docsDir, SCREENSHOTS)}`).toBeGreaterThan(0);
    for (const shot of shots) {
      const name = relative(docsDir, shot);
      const chunks = webpChunks(shot);
      expect(name).toMatch(/\.webp$/);
      expect(chunks, `${name} is lossless (VP8L), so small UI text stays exact`).toContain("VP8L");
      expect(chunks, `${name} has no lossy (VP8) image`).not.toContain("VP8 ");
      expect(readFileSync(shot).length, `${name} bytes`).toBeLessThanOrEqual(BUDGET_BYTES);
    }
  });
});
