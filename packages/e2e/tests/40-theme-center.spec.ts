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

test("previews either overlay over a chosen backdrop and says when edits are unsaved", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/styles");

  // Freshly loaded, the preview shows exactly what OBS shows.
  await expect(page.getByText("Matches the saved theme")).toBeVisible();

  const previewTimer = page.getByRole("button", { name: "Preview timer" });
  const previewTasks = page.getByRole("button", { name: "Preview tasks" });
  await expect(previewTimer).toHaveAttribute("aria-pressed", "true");
  await previewTasks.click();
  await expect(previewTasks).toHaveAttribute("aria-pressed", "true");
  await expect(previewTimer).toHaveAttribute("aria-pressed", "false");
  // The sample rows come from the shared demo session. A list taller than the source
  // scrolls, which renders the rows twice, hence first().
  await expect(page.getByText("Sketch three logo concepts").first()).toBeVisible();

  const bright = page.getByRole("button", { name: "Bright backdrop" });
  await bright.click();
  await expect(bright).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Dark backdrop" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // An edit is previewed before it is saved. The label is unique per run, so a retry
  // against the same database still changes something.
  await previewTimer.click();
  await page.getByLabel("Finished", { exact: true }).fill(`All done ${Date.now() % 100_000}`);
  await expect(page.getByText("Previewing unsaved changes")).toBeVisible();
  // The save bar names it too (its live region repeats the words for screen readers).
  await expect(page.getByText("Unsaved — not on stream yet").first()).toBeVisible();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();
  await expect(page.getByText("Matches the saved theme")).toBeVisible();
});
