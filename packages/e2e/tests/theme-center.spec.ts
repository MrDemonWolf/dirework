import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("applies a preset, saves it, and finds it selected after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/styles");

  const presets = page.getByRole("radiogroup", { name: "Theme presets" }).getByRole("radio");
  await expect(presets.first()).toBeVisible();
  const count = await presets.count();
  expect(count).toBeGreaterThan(1);

  await presets.nth(count - 1).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();

  await page.reload();
  await expect(presets.nth(count - 1)).toHaveAttribute("aria-checked", "true");
});
