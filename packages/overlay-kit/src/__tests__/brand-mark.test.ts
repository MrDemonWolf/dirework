// The wolf-and-clock mark is drawn by the web header, the docs BrandMark and the share card
// from BRAND_MARK. The two favicons are static SVG files, so they can't import it; this holds
// them to the same shapes, and keeps every other renderer from re-typing the geometry.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_MARK } from "../index";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const ICON_FILES = ["apps/web/public/icons/icon.svg", "apps/fumadocs/src/app/icon.svg"];

/** Every .ts/.tsx source file under `dir`, skipping dependencies and build output. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".open-next", "out", "dist", ".source"].includes(name)) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("BRAND_MARK", () => {
  it.each(ICON_FILES)("%s draws exactly BRAND_MARK's shapes", (file) => {
    const svg = readFileSync(path.join(repoRoot, file), "utf8");
    expect(svg).toContain(`viewBox="${BRAND_MARK.viewBox}"`);
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toEqual([...BRAND_MARK.paths]);
    const circles = [...svg.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="([\d.]+)"/g)].map((m) => ({
      cx: Number(m[1]),
      cy: Number(m[2]),
      r: Number(m[3]),
    }));
    expect(circles).toEqual([...BRAND_MARK.eyes, BRAND_MARK.clock.face]);
    const lines = [...svg.matchAll(/<line x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/g)].map(
      (m) => ({ x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]) }),
    );
    expect(lines).toEqual([...BRAND_MARK.clock.hands]);
  });

  it("is the only place the mark's geometry is typed out in source", () => {
    const roots = ["apps/web/src", "apps/fumadocs/src", "packages/overlay-kit/src"];
    const copies = roots
      .flatMap((root) => sourceFiles(path.join(repoRoot, root)))
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => readFileSync(file, "utf8").includes(BRAND_MARK.paths[0]))
      .map((file) => path.relative(repoRoot, file));
    expect(copies).toEqual(["packages/overlay-kit/src/index.ts"]);
  });
});
