// The social share card is a static file (public/og.png, rendered at build by
// scripts/render-og.ts), not an `opengraph-image` route: next/og's renderer (resvg and yoga
// wasm, a bundled font, Satori) would otherwise ride in every Worker isolate for a card no
// request ever renders.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { SHARE_CARD_ALT, SHARE_CARD_SIZE } from "@dirework/overlay-kit/share-card";

import { OG_IMAGE_FILE, renderOgPng } from "../../../scripts/render-og";

import { pngSize } from "./png";

// The root layout's stylesheet, fonts and providers need Next's build; generateMetadata needs
// none of them.
vi.mock("../../index.css", () => ({}));
vi.mock("@/lib/fonts", () => ({ plexMono: { variable: "" }, plexSans: { variable: "" } }));
vi.mock("@/components/providers", () => ({ default: () => null }));

const webDir = path.resolve(__dirname, "../../..");
const srcDir = path.join(webDir, "src");

/** Every .ts/.tsx file under `dir`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("social share card", () => {
  it("nothing under src imports next/og, so its renderer stays out of the Worker", () => {
    const importers = sourceFiles(srcDir)
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => /["']next\/og["']/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(webDir, file));
    expect(importers).toEqual([]);
  });

  it("is not an opengraph-image or twitter-image route", () => {
    const routes = readdirSync(path.join(srcDir, "app")).filter((name) =>
      /^(opengraph|twitter)-image\./.test(name),
    );
    expect(routes).toEqual([]);
  });

  it("renders the shared card as a 1200x630 PNG", async () => {
    const png = await renderOgPng();
    expect(pngSize(png)).toEqual(SHARE_CARD_SIZE);
    // A real card, not an empty canvas: the gradient, text and mark compress to tens of KiB.
    expect(png.byteLength).toBeGreaterThan(20_000);
  }, 30_000);

  it("writes it into public/, where Workers Static Assets serve it", () => {
    expect(OG_IMAGE_FILE).toBe(path.join(webDir, "public", "og.png"));
    // Generated at build, never committed.
    const ignore = readFileSync(path.join(webDir, ".gitignore"), "utf8");
    expect(ignore.split("\n")).toContain("/public/og.png");
  });

  it("is built before both the Next build and the Worker build", () => {
    const { scripts } = JSON.parse(readFileSync(path.join(webDir, "package.json"), "utf8"));
    expect(scripts.build).toMatch(/^bun run render-og && /);
    expect(scripts["build:worker"]).toMatch(/^bun run render-og && /);
  });

  it("is cached like the other unhashed public files", () => {
    const headers = readFileSync(path.join(webDir, "public/_headers"), "utf8");
    expect(headers).toMatch(
      /^\/og\.png\n {2}Cache-Control: public, max-age=86400, stale-while-revalidate=2592000$/m,
    );
  });

  it("is declared in the root metadata for Open Graph and Twitter, with size and alt", async () => {
    const { generateMetadata } = await import("../layout");
    const metadata = generateMetadata();
    const image = {
      url: "/og.png",
      width: SHARE_CARD_SIZE.width,
      height: SHARE_CARD_SIZE.height,
      alt: SHARE_CARD_ALT,
      type: "image/png",
    };
    expect(metadata.openGraph?.images).toEqual([image]);
    expect(metadata.twitter?.images).toEqual([image]);
  });
});
