/// <reference lib="dom" />
// (page.evaluate callbacks run in the browser; the e2e tsconfig has no DOM lib otherwise.)

import { expect, type Page, test } from "@playwright/test";

/**
 * A hard reload must paint in the stored theme before any JavaScript bundle runs. Every
 * /_next/static script is aborted, so React never hydrates and next-themes never runs: only
 * the inline <head> bootstrap (lib/theme-init.ts) and the CSS can produce what we see. The OS
 * reports light, so a dark first paint can only come from the stored preference.
 */

type HtmlPaint = { className: string; colorScheme: string; rgba: number[] };

/** The <html> theme class, computed color-scheme, and background resolved to RGBA. */
async function readHtmlPaint(page: Page): Promise<HtmlPaint> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const style = getComputedStyle(html);
    // The background is an oklch() token; let a canvas resolve it to sRGB channels.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return {
      className: html.className,
      colorScheme: style.colorScheme,
      rgba: [...ctx.getImageData(0, 0, 1, 1).data],
    };
  });
}

async function reloadWithoutScripts(page: Page, storedTheme: string): Promise<void> {
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("theme", t), storedTheme);
  await page.emulateMedia({ colorScheme: "light" });
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

/**
 * Serve `path` with everything from `<body` on cut off: the moment of a streamed response
 * when the <head> (stylesheets and the inline theme script) has arrived and painted but the
 * body chunk hasn't. Waits for "load" so the head's stylesheets have applied.
 */
async function gotoHeadOnly(page: Page, pagePath: string): Promise<void> {
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.route(
    (url) => url.pathname === pagePath,
    async (route) => {
      // Only the navigation itself; a leftover RSC prefetch of the same path passes through.
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const html = await response.text();
      const bodyAt = html.indexOf("<body");
      expect(bodyAt, "the document has a <body>").toBeGreaterThan(0);
      const { "content-length": _length, ...headers } = response.headers();
      await route.fulfill({ response, headers, body: html.slice(0, bodyAt) });
    },
  );
  await page.goto(pagePath, { waitUntil: "load" });
}

test("a stored dark theme paints dark before hydration, even on a light OS", async ({ page }) => {
  await reloadWithoutScripts(page, "dark");
  const paint = await readHtmlPaint(page);
  expect(paint.className.split(" ")).toContain("dark");
  expect(paint.colorScheme).toBe("dark");
  // Opaque: the canvas itself is painted, not left transparent over the UA's white.
  expect(paint.rgba[3]).toBe(255);
  for (const channel of paint.rgba.slice(0, 3)) expect(channel).toBeLessThan(60);
});

test("a stored light theme paints light before hydration", async ({ page }) => {
  await reloadWithoutScripts(page, "light");
  const paint = await readHtmlPaint(page);
  expect(paint.className.split(" ")).toContain("light");
  expect(paint.colorScheme).toBe("light");
  expect(paint.rgba[3]).toBe(255);
  for (const channel of paint.rgba.slice(0, 3)) expect(channel).toBeGreaterThan(200);
});

test("the head alone already paints a stored dark theme", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.emulateMedia({ colorScheme: "light" });
  await gotoHeadOnly(page, "/");
  const paint = await readHtmlPaint(page);
  expect(paint.className.split(" ")).toContain("dark");
  expect(paint.rgba[3]).toBe(255);
  for (const channel of paint.rgba.slice(0, 3)) expect(channel).toBeLessThan(60);
});

test("overlays keep a transparent canvas for OBS", async ({ page }) => {
  await page.goto("/overlay/t/anything");
  const background = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(background).toBe("rgba(0, 0, 0, 0)");
});

test("an overlay's canvas is transparent before its body arrives", async ({ page }) => {
  // The (overlay) layout's own transparent override lives in <body>; with only the head
  // painted, the canvas must already be transparent or OBS shows a navy frame.
  await gotoHeadOnly(page, "/overlay/t/anything");
  const paint = await page.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
  }));
  expect(paint).toEqual({
    surface: "overlay",
    html: "rgba(0, 0, 0, 0)",
    body: "rgba(0, 0, 0, 0)",
  });
});
