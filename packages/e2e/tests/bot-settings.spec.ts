import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("edits a reply, previews it as chat would show it, saves, and resets it", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await expect(page.getByRole("heading", { name: "Bot settings" })).toBeVisible();

  const custom = 'Got it, {user}: "{task}" is on the list.';
  const field = page.getByLabel("Task added", { exact: true });
  await field.fill(custom);
  // The preview runs the bot's own interpolate with sample values: the owner's name
  // stands in for the viewer.
  await expect(
    page.getByText('Got it, Dev Streamer: "write the intro" is on the list.'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Bot settings saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Task added", { exact: true })).toHaveValue(custom);

  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByLabel("Task added", { exact: true })).not.toHaveValue(custom);
  await expect(page.getByRole("button", { name: "Reset to default" })).toHaveCount(0);
});
