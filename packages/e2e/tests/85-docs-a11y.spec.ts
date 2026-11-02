import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * axe over the docs site's static export (apps/fumadocs/out, written by verify.yml's
 * "Production build" step before this suite runs): the landing page and a spread of docs
 * pages, in the dark and the light theme, at desktop and phone width. Unlike 80-a11y it
 * fails on ANY violation of WCAG 2.0/2.1/2.2 A and AA or axe's best practices (landmarks,
 * headings, region), since the docs have no data-dependent screens to excuse. AAA contrast
 * is not gated: the docs inherit the app palette, which targets AA.
 *
 * The export is served by a tiny static server here, so the spec needs no running docs
 * dev server. Locally it skips when the export is missing (`bun run build` in
 * apps/fumadocs first); in CI a missing export fails.
 */

const OUT = fileURLToPath(new URL("../../../apps/fumadocs/out", import.meta.url));
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const PAGES = [
  "/",
  "/docs",
  "/docs/getting-started",
  "/docs/deployment",
  "/docs/chat-commands",
  "/docs/overlays",
  "/docs/troubleshooting",
];
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

/** The export's file for a URL path: exact file, `<path>.html`, or `<path>/index.html`. */
function resolveFile(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(OUT, candidate);
    if (file.startsWith(OUT) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

let server: Server;
let origin = "";

test.beforeAll(async () => {
  if (!existsSync(OUT)) return;
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const file = resolveFile(path === "/" ? "/index.html" : path);
    if (!file) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      res.end(readFileSync(join(OUT, "404.html")));
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
});

test.use({ reducedMotion: "reduce" });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const scheme of ["dark", "light"] as const) {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`docs ${path} passes axe (${scheme}, ${viewport.name})`, async ({ page }) => {
        test.skip(!existsSync(OUT) && !process.env.CI, "docs export missing: build apps/fumadocs");
        expect(existsSync(OUT), `docs export at ${OUT}`).toBe(true);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(viewport);
        await page.goto(origin + path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // The theme ("system" by default) is applied by a script; scan the settled palette.
        await page.waitForFunction(
          (dark) => document.documentElement.classList.contains("dark") === dark,
          scheme === "dark",
        );
        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const failures = results.violations.map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.nodes
              .map((node) => node.target.join(" "))
              .join(", ")}`,
        );
        expect(failures, `axe violations on ${path} (${scheme}, ${viewport.name})`).toEqual([]);
      });
    }
  }
}
