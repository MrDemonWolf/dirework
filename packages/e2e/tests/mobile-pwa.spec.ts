/// <reference lib="dom" />
// (page.evaluate callbacks run in the browser; the e2e tsconfig has no DOM lib otherwise.)

import { devices, expect, test } from "@playwright/test";

import { signIn } from "./helpers";

// A phone: small viewport, touch, coarse pointer, no hover. The project already runs
// Chromium, so only the device's viewport and input settings are taken.
const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];
test.use(pixel7);

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

test("the dashboard fits a phone screen without horizontal scrolling", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the dashboard links an installable standalone manifest", async ({ page }) => {
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute("href", "/manifest.webmanifest");

  const res = await page.request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ display: "standalone", start_url: "/dashboard" });
});

test("the browser bar follows the app's theme, not the OS's", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  const metas = page.locator('meta[name="theme-color"]');
  await expect(metas).toHaveCount(2);
  for (const meta of await metas.all()) await expect(meta).toHaveAttribute("content", "#0c0c0e");
});

test("task-row actions are shown on touch without a hover", async ({ page }) => {
  const text = `Phone task ${Date.now()}`;
  await page.getByLabel("New task text").fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  // toBeVisible ignores opacity, and the hover-reveal hides these with opacity-0.
  const remove = page.getByLabel(`Remove "${text}"`);
  await expect(remove).toBeVisible();
  await expect(remove).toHaveCSS("opacity", "1");
});

test.describe("on a touch tablet wider than the lg breakpoint", () => {
  // The old `lg:opacity-0` hid these at >= 1024px whatever the pointer, and group-hover
  // can never fire on touch, so they were unreachable on a landscape tablet.
  test.use({ viewport: { width: 1280, height: 800 } });

  test("task-row actions are still shown", async ({ page }) => {
    const text = `Tablet task ${Date.now()}`;
    await page.getByLabel("New task text").fill(text);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByLabel(`Remove "${text}"`)).toHaveCSS("opacity", "1");
  });
});
