import { existsSync } from "node:fs";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { DOCS_OUT, type DocsServer, serveDocs } from "./docs-export";

/**
 * axe over the docs site's static export (apps/fumadocs/out, written by verify.yml's
 * "Production build" step before this suite runs): the landing page and a spread of docs
 * pages, in the dark and the light theme, at desktop and phone width. Unlike 80-a11y it
 * fails on ANY violation of WCAG 2.0/2.1/2.2 A and AA or axe's best practices (landmarks,
 * headings, region), since the docs have no data-dependent screens to excuse. AAA contrast
 * is not gated: the docs inherit the app palette, which targets AA.
 *
 * The export is served by a tiny static server (docs-export.ts, shared with
 * 86-docs-search), so the spec needs no running docs dev server. Locally it skips when the
 * export is missing (`bun run build` in apps/fumadocs first); in CI a missing export fails.
 */

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

let docs: DocsServer | undefined;

test.beforeAll(async () => {
  if (existsSync(DOCS_OUT)) docs = await serveDocs();
});

test.afterAll(async () => {
  await docs?.close();
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
        test.skip(
          !existsSync(DOCS_OUT) && !process.env.CI,
          "docs export missing: build apps/fumadocs",
        );
        expect(existsSync(DOCS_OUT), `docs export at ${DOCS_OUT}`).toBe(true);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(viewport);
        await page.goto(`${docs?.origin}${path}`);
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
