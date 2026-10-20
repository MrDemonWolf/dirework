import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.join(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Source files only: the tests themselves quote the strings they search for.
const sources = walk(srcRoot).filter(
  (file) => /\.(ts|tsx)$/.test(file) && !file.includes(`${path.sep}__tests__${path.sep}`),
);
const relative = (file: string) => path.relative(srcRoot, file).split(path.sep).join("/");

describe("font scoping", () => {
  // public/fonts/fonts.css declares every overlay family. Only the surfaces that render
  // overlay content may load it; the landing, dashboard and bot pages must not pay for it.
  it("loads the overlay font stylesheet only where overlay content renders", () => {
    const loaders = sources
      .filter((file) => readFileSync(file, "utf8").includes('href="/fonts/fonts.css"'))
      .map(relative)
      .sort();
    expect(loaders).toEqual(["app/(app)/dashboard/styles/page.tsx", "app/(overlay)/layout.tsx"]);
  });

  // The heading face is preloaded, so it must stay out of the root layout's module graph:
  // next/font would otherwise emit that preload for the OBS overlays too.
  it("imports the preloaded heading font only from the (app) and (bot) layouts", () => {
    const importers = sources
      .filter((file) => readFileSync(file, "utf8").includes("@/lib/heading-font"))
      .map(relative)
      .sort();
    expect(importers).toEqual(["app/(app)/layout.tsx", "app/(bot)/layout.tsx"]);
    expect(readFileSync(path.join(srcRoot, "lib/heading-font.ts"), "utf8")).toContain(
      "preload: true",
    );
    expect(readFileSync(path.join(srcRoot, "lib/fonts.ts"), "utf8")).not.toContain("preload: true");
  });
});
