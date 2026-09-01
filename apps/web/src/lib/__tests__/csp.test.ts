import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.join(__dirname, "../../..");
const appDir = path.join(webRoot, "src/app");

function appSources(): { file: string; source: string }[] {
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.(tsx?|css)$/.test(entry))
    .map((entry) => ({
      file: entry,
      source: readFileSync(path.join(appDir, entry), "utf8"),
    }));
}

describe("Content Security Policy", () => {
  it("ships the enforcing header, not Report-Only", () => {
    const config = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");

    expect(config).toContain('key: "Content-Security-Policy"');
    expect(config).not.toContain('"Content-Security-Policy-Report-Only"');
  });

  // The stream-fatal regression. `style-src`/`font-src` are 'self'-only, so an
  // external font host in a route silently drops OBS overlays to a fallback
  // face mid-stream. Every picker family is already self-hosted under
  // public/fonts (see overlay-fonts.test.ts) — there is no reason to reach out.
  it("loads no external font host from any route", () => {
    for (const { file, source } of appSources()) {
      expect(source, `${file} references an external font host`).not.toMatch(
        /fonts\.(googleapis|gstatic)\.com/,
      );
    }
  });

  // Generalises the above: any <link rel="stylesheet"> must be same-origin to
  // survive `style-src 'self'`, whoever adds it and wherever it points.
  it("links only same-origin stylesheets", () => {
    for (const { file, source } of appSources()) {
      // No dotAll flag — apps/web targets ES2017, and `[^>]` spans newlines anyway.
      for (const [element] of source.matchAll(/<link\b[^>]*>/g)) {
        if (!element.includes('rel="stylesheet"')) continue;
        const href = element.match(/href="([^"]+)"/)?.[1] ?? "";
        expect(href, `${file} links a cross-origin stylesheet`).toMatch(/^\//);
      }
    }
  });
});
