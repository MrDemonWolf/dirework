import { expect, test } from "@playwright/test";

import { confirmDialog, signIn } from "./helpers";

// Runs only in the `mobile` project (Pixel 7 emulation, see playwright.config.ts).
test("the dashboard fits a phone and the menu button reaches the Theme Center", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Nothing may be wider than the phone: a horizontal scrollbar means a layout overflow.
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, "page wider than the viewport").toBeLessThanOrEqual(widths.client);

  // The desktop nav is hidden at this width; the hamburger opens the mobile nav instead.
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("link", { name: "Theme Center" }).click();
  await expect(page.getByRole("heading", { name: "Theme Center" })).toBeVisible();

  // The Theme Center fits too: its preset gallery and preview canvas once widened the page.
  // Below lg the preview starts as a collapsed sticky bar above the editors.
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(page.getByRole("button", { name: "Preview timer" })).toBeVisible();
  const themeWidths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(themeWidths.scroll, "Theme Center wider than the viewport").toBeLessThanOrEqual(
    themeWidths.client,
  );
});

test.describe("on a 320px phone", () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test("the dashboard fits with a running timer and its settings open", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/dashboard");

    // Skip and Stop mount only once a run starts, which is when the transport got widest.
    const start = page.getByRole("button", { name: "Start", exact: true });
    const stop = page.getByRole("button", { name: "Stop timer" });
    await expect(start.or(stop)).toBeVisible();
    if (await start.isVisible()) await start.click();
    await expect(stop).toBeVisible();
    await page.getByRole("button", { name: /Edit session settings/ }).click();
    const pomosUnit = page.getByText("pomos", { exact: true });
    await expect(pomosUnit).toBeVisible();

    const layout = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(layout.scroll, "page wider than a 320px viewport").toBeLessThanOrEqual(layout.client);

    // The header row must keep real slack, not fit to the pixel: text renders a few px wider
    // on Linux than on macOS, so a 1.5px margin here overflowed the page on CI.
    const logo = await page
      .getByRole("link", { name: /DireWork/ })
      .first()
      .boundingBox();
    const themeSwitch = await page.getByRole("switch", { name: "Toggle dark mode" }).boundingBox();
    expect(logo, "logo has no box").not.toBeNull();
    expect(themeSwitch, "theme switch has no box").not.toBeNull();
    // The 16px sun icon and an 8px gap sit left of the switch.
    const toggleLeft = themeSwitch!.x - 24;
    expect(
      toggleLeft - (logo!.x + logo!.width),
      "logo crowds the theme toggle",
    ).toBeGreaterThanOrEqual(4);

    // The timer panels clip with overflow-hidden, so a too-wide row never widens the page:
    // check that the right-most controls end inside the viewport instead.
    for (const [name, locator] of [
      ["Stop button", stop],
      ["pomos unit", pomosUnit],
    ] as const) {
      const box = await locator.boundingBox();
      expect(box, `${name} has no box`).not.toBeNull();
      expect(box!.x + box!.width, `${name} clipped`).toBeLessThanOrEqual(layout.client - 16);
    }

    // Leave the timer idle for the specs that run after this one.
    await stop.click();
    await confirmDialog(page, "Stop timer");
    await expect(start).toBeVisible();
  });
});

test("every Bot settings page fits a phone and the sub-nav reaches each one", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await expect(page.getByRole("heading", { level: 1, name: "Bot settings" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Bot settings sections" });
  for (const [link, landmark] of [
    ["Overview", page.getByRole("heading", { name: "Live controls" })],
    ["Commands", page.getByRole("heading", { name: "Aliases" })],
    ["Replies", page.getByRole("tab", { name: "Timer replies" })],
    ["Moderation", page.getByRole("heading", { name: "Blocked viewers" })],
  ] as const) {
    await nav.getByRole("link", { name: link }).click();
    await expect(landmark).toBeVisible();
    await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll, `${link} wider than the viewport`).toBeLessThanOrEqual(widths.client);
  }
});

test("the style editor rows fit a 320px phone with 44px touch controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await signIn(page);
  await page.goto("/dashboard/styles");
  await expect(page.getByRole("radiogroup", { name: "Theme presets" })).toBeVisible();
  for (const section of ["Typography", "Layout", "Opacity"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
  }
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, "style editor wider than the viewport").toBeLessThanOrEqual(widths.client);

  // A coarse pointer gets 44px targets: a color field, a length, a font.
  const colorField = page.getByRole("textbox", { name: "Track", exact: true }).locator("..");
  const controls = [
    colorField,
    page.getByRole("textbox", { name: "Time", exact: true }),
    page.getByRole("combobox", { name: "Font family" }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0, String(control)).toBeGreaterThanOrEqual(43.5);
  }
  // The swatch fills the color field's left square, inside its 1px border.
  const swatch = await page.getByLabel("Track color picker").boundingBox();
  expect(swatch?.width ?? 0).toBeGreaterThanOrEqual(43.5);
  expect(swatch?.height ?? 0).toBeGreaterThanOrEqual(41.5);
});

test("on a phone the Save bar stacks its buttons under the status", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot/replies");
  await expect(page.getByRole("tab", { name: "Task replies" })).toBeVisible();

  await page.getByRole("button", { name: /^Adding/ }).click();
  const field = page.getByLabel("Task added", { exact: true });
  const original = await field.inputValue();
  await field.fill(`${original} (phone)`);

  const status = page.getByText("Unsaved replies", { exact: true }).last();
  const save = page.getByRole("button", { name: "Save changes" });
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  await expect(save).toBeVisible();
  const [statusBox, saveBox, resetBox] = await Promise.all([
    status.boundingBox(),
    save.boundingBox(),
    reset.boundingBox(),
  ]);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  // Second row, side by side, inside the viewport.
  expect(saveBox!.y).toBeGreaterThan(statusBox!.y + statusBox!.height - 1);
  expect(Math.abs(saveBox!.y - resetBox!.y)).toBeLessThan(2);
  expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(width);
  // Nothing was saved: leave without keeping the edit.
  await field.fill(original);
  await expect(save).toHaveCount(0);
});
