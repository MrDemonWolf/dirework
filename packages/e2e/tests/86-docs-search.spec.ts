import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { DOCS_OUT, type DocsServer, serveDocs } from "./docs-export";

/**
 * Docs search over the static export, served with GitHub Pages' caching header
 * (docs-export.ts). The search index (/api/search, ~1.4 MB of JSON) used to be requested only
 * by the first non-empty query, after fumadocs' 100 ms debounce, so that query waited for the
 * whole download. components/search.tsx now fetches it when the dialog opens: the download
 * runs while the reader types, and the first query reads it back from the HTTP cache.
 */

const INDEX = "/api/search";

let docs: DocsServer | undefined;

test.beforeAll(async () => {
  if (existsSync(DOCS_OUT)) docs = await serveDocs();
});

test.afterAll(async () => {
  await docs?.close();
});

test.use({ reducedMotion: "reduce" });

test("docs search fetches its index on open, before a key is typed, then finds results", async ({
  page,
}) => {
  test.skip(!existsSync(DOCS_OUT) && !process.env.CI, "docs export missing: build apps/fumadocs");
  expect(existsSync(DOCS_OUT), `docs export at ${DOCS_OUT}`).toBe(true);
  const hits = () => docs?.hits(INDEX) ?? 0;
  let downloaded = 0;
  page.on("requestfinished", (request) => {
    if (new URL(request.url()).pathname === INDEX) downloaded += 1;
  });

  await page.goto(`${docs?.origin}/docs`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Hydrated (the hotkey listener is attached) and the preloaded dialog chunks are in.
  await page.waitForLoadState("networkidle");
  expect(hits(), "a page view never loads the index").toBe(0);

  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(hits, { message: "opening search requests the index before a key is typed" })
    .toBe(1);
  await expect.poll(() => downloaded, { message: "the warm-up downloads the whole index" }).toBe(1);

  await dialog.getByRole("combobox", { name: "Search" }).fill("overlay");
  await expect(dialog.getByRole("option").first()).toBeVisible();
  expect(hits(), "the first query reads the warmed index from the HTTP cache").toBe(1);
});
