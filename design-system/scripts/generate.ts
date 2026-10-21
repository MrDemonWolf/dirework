#!/usr/bin/env bun
/**
 * Dirework design token generator (file I/O only; the rendering is in render.ts).
 *
 * Reads `design-system/tokens.json` and writes:
 *   - apps/web/src/tokens.generated.css          (imported by apps/web/src/index.css)
 *   - apps/fumadocs/src/app/tokens.generated.css (imported by apps/fumadocs/src/app/global.css)
 *   - apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts (docs theme gallery)
 *
 * apps/web/src/lib/__tests__/design-tokens.test.ts fails CI when a committed CSS file
 * differs from what render.ts produces; theme-palette-sync.test.ts guards the overlay
 * palette against the web app's theme presets and the squircle radius.
 *
 * Idempotent: re-running produces identical files, so drift shows up with
 * `bun run tokens && git diff --exit-code` (a CI step in verify.yml).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { type DesignTokens, renderAll } from "./render";

const ROOT = resolve(import.meta.dir, "..", "..");
const tokens = JSON.parse(
  readFileSync(resolve(ROOT, "design-system/tokens.json"), "utf8"),
) as DesignTokens;

function write(path: string, content: string) {
  const full = resolve(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  // JSON.stringify output isn't Biome-formatted; format TS with the lockfile-pinned
  // Biome so it passes `bun run lint`. Biome does not handle the CSS (biome.json
  // excludes it), so render.ts emits that already formatted.
  if (/\.tsx?$/.test(path)) {
    const format = Bun.spawnSync([process.execPath, "x", "biome", "format", "--write", full], {
      cwd: ROOT,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (format.exitCode !== 0) throw new Error(`biome format failed for ${path}`);
  }
  console.log(`  ✓ ${path}`);
}

console.log("Generating Dirework design tokens…");
for (const [path, content] of Object.entries(renderAll(tokens))) write(path, content);
console.log("Done.");
