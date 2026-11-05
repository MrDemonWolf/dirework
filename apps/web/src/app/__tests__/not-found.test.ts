import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OVERLAY_SURFACE } from "@/lib/theme-init";
import NotFound, { metadata } from "../not-found";

/**
 * The root not-found page answers every unmatched URL (the prerendered /_not-found) and any
 * notFound() without a closer boundary. For an unmatched URL it renders inside the root layout
 * only, so it brings its own landmark and way home. It must stay static (one Worker
 * invocation per 404, no api request), and it must vanish on the transparent OBS surfaces a
 * truncated overlay URL lands on. e2e: 10-smoke, 80-a11y, theme-flash.
 */

const appDir = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(appDir, file), "utf8");
const html = renderToStaticMarkup(createElement(NotFound));

describe("root not-found page", () => {
  it("titles the tab through the root layout's template", () => {
    expect(metadata.title).toBe("Page not found");
  });

  it("is a main landmark with one h1 and a link home", () => {
    expect(html).toMatch(/^<main /);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Page not found<\/h1>/);
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to home<\/a>/);
  });

  it("hides itself on overlay surfaces", () => {
    // The root element carries the variant; index.css keys it on the attribute that
    // lib/theme-init.ts sets on <html> before first paint.
    expect(html).toMatch(/^<main [^>]*class="[^"]*\bon-overlay:hidden\b/);
    expect(read("../index.css")).toContain(
      `@custom-variant on-overlay (&:where(html[data-surface="${OVERLAY_SURFACE}"] *));`,
    );
  });

  it("stays a static server component that never prefetches home", () => {
    const source = read("not-found.tsx");
    expect(source).not.toContain('"use client"');
    // A request-time API (headers(), cookies(), connection(), a session read) would make
    // /_not-found dynamic: a render per 404 instead of the prerendered page.
    const imports = [...source.matchAll(/^import [^;]* from "([^"]+)";$/gm)].map(
      (match) => match[1],
    );
    expect(imports).toContain("next/link");
    for (const dynamic of ["next/headers", "next/server", "@/lib/server-session"]) {
      expect(imports).not.toContain(dynamic);
    }
    // A prefetch of `/` renders the (app) layout, whose session check is an api request.
    expect(source).toContain("prefetch={false}");
  });
});
