import { expect, test } from "@playwright/test";

import { signIn, waitForHydration } from "./helpers";

test("edits a reply, previews it as chat would show it, saves, and resets it", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  // A per-attempt stamp keeps this idempotent under CI retries: a previous attempt may have
  // saved its own value, and the Save bar only appears when the draft differs from it.
  const stamp = `${test.info().retry}-${Date.now()}`;
  const custom = `Got it, {user}: "{task}" is on the list. [${stamp}]`;
  const field = page.getByLabel("Task added", { exact: true });
  await field.fill(custom);
  // The preview runs the bot's own interpolate with sample values: the owner's name
  // stands in for the viewer.
  await expect(
    page.getByText(`Got it, Dev Streamer: "write the intro" is on the list. [${stamp}]`),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Bot settings saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Task added", { exact: true })).toHaveValue(custom);

  // Back to stock, and saved, so the database ends where it started.
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByLabel("Task added", { exact: true })).not.toHaveValue(custom);
  await expect(page.getByRole("button", { name: "Reset to default" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Bot settings saved")).toBeVisible();
});
