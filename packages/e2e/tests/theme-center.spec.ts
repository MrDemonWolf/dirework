import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("applies a preset, saves it, and finds it selected after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/styles");

  const presets = page.getByRole("radiogroup", { name: "Theme presets" }).getByRole("radio");
  await expect(presets.first()).toBeVisible();

  // Pick a preset that is NOT selected right now. A CI retry runs against the same database,
  // so the preset a previous attempt saved is already checked, and clicking it would change
  // nothing: the Save bar only appears for unsaved changes.
  const checked = await presets.evaluateAll((radios) =>
    radios.map((radio) => radio.getAttribute("aria-checked")),
  );
  const target = checked.lastIndexOf("false");
  expect(target, "expected at least one unselected preset").toBeGreaterThan(-1);

  await presets.nth(target).click();
  await expect(presets.nth(target)).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();

  await page.reload();
  await expect(presets.nth(target)).toHaveAttribute("aria-checked", "true");
});
