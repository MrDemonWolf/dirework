import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

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
});
