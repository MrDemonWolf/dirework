import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The UI faces both Next apps load through next/font/local. A build that imports
// next/font/google instead downloads from fonts.googleapis.com, and a runner that can't
// reach it fails with "Can't resolve '@vercel/turbopack-next/internal/font/google/font'".
const repoRoot = path.join(__dirname, "../../../..");
const filesDir = path.join(__dirname, "../../files");
const appSrcDirs = ["apps/web/src", "apps/fumadocs/src"].map((dir) => path.join(repoRoot, dir));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = appSrcDirs
  .flatMap(walk)
  .filter(
    (file) => /\.(ts|tsx|css)$/.test(file) && !file.includes(`${path.sep}__tests__${path.sep}`),
  );
const relative = (file: string) => path.relative(repoRoot, file).split(path.sep).join("/");

describe("self-hosted UI fonts", () => {
  it("never imports next/font/google, so builds make no network calls", () => {
    const offenders = sources
      .filter((file) => readFileSync(file, "utf8").includes("next/font/google"))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("points every next/font/local src at a committed woff2 file", () => {
    const loaders = sources.filter((file) =>
      readFileSync(file, "utf8").includes("next/font/local"),
    );
    expect(loaders.map(relative).sort()).toEqual([
      "apps/fumadocs/src/app/layout.tsx",
      "apps/web/src/lib/fonts.ts",
      "apps/web/src/lib/heading-font.ts",
    ]);

    const referenced = new Set<string>();
    for (const file of loaders) {
      const paths = [...readFileSync(file, "utf8").matchAll(/path: "([^"]+\.woff2)"/g)].map(
        (match) => match[1] ?? "",
      );
      expect(paths.length).toBeGreaterThan(0);
      for (const fontPath of paths) {
        const resolved = path.resolve(path.dirname(file), fontPath);
        expect(path.dirname(resolved)).toBe(filesDir);
        expect(statSync(resolved).isFile()).toBe(true);
        referenced.add(path.basename(resolved));
      }
    }
    // Every shipped file is used: no dead weight in the repo or the bundle.
    expect([...referenced].sort()).toEqual(readdirSync(filesDir).sort());
  });

  // Both apps reach the files by relative path, so Turbo only rebuilds them when a font
  // changes because of these two edges: without them a font-only change could restore a
  // stale cached build.
  it("makes a font change invalidate both apps' cached builds", () => {
    for (const app of ["apps/web", "apps/fumadocs"]) {
      const pkg = JSON.parse(readFileSync(path.join(repoRoot, app, "package.json"), "utf8"));
      expect(pkg.dependencies?.["@dirework/fonts"], app).toBe("workspace:*");
    }
    const turbo = JSON.parse(readFileSync(path.join(repoRoot, "turbo.json"), "utf8"));
    expect(turbo.tasks.build.inputs).toContain("$TURBO_ROOT$/packages/fonts/files/**");
  });

  it("ships only real woff2 files", () => {
    for (const file of readdirSync(filesDir)) {
      expect(file).toMatch(/^[a-z0-9_-]+\.woff2$/);
      const head = readFileSync(path.join(filesDir, file)).subarray(0, 4).toString("latin1");
      expect(head).toBe("wOF2");
    }
  });
});
