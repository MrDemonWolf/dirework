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
  // Reply groups start collapsed (a group with an unsaved or invalid field opens itself).
  const adding = page.getByRole("button", { name: /^Adding/ });
  await adding.click();
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
  await waitForHydration(page);
  await page.getByRole("button", { name: /^Adding/ }).click();
  await expect(page.getByLabel("Task added", { exact: true })).toHaveValue(custom);

  // Back to stock, and saved, so the database ends where it started.
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByLabel("Task added", { exact: true })).not.toHaveValue(custom);
  await expect(page.getByRole("button", { name: "Reset to default" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Bot settings saved")).toBeVisible();
});

test("the Save bar's reason clears a filter hiding the reply it names", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  await page.getByRole("button", { name: /^Adding/ }).click();
  const field = page.getByLabel("Task added", { exact: true });
  // Over the 300-byte cap, so Save is blocked on this reply. Nothing is saved: the database
  // is untouched and the spec stays repeatable.
  await field.fill("x".repeat(301));
  // A filter that matches other replies but not this one takes it off the page.
  const filter = page.getByLabel("Filter messages");
  await filter.fill("cleared");
  await expect(page.getByLabel("Cleared all", { exact: true })).toBeVisible();
  await expect(field).toHaveCount(0);

  await page.getByRole("button", { name: "'Task added' is over the 300-byte chat limit" }).click();
  await expect(filter).toHaveValue("");
  await expect(field).toBeFocused();
});

test("Enter in the block field opens the block confirm", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  await page.getByRole("link", { name: "Jump to Moderation" }).click();
  const login = page.getByLabel("Twitch username");
  await login.fill("@E2E_Enter_Check");
  await login.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: "Block e2e_enter_check?" });
  await expect(dialog).toBeVisible();
  // Cancel, so nothing is blocked and the spec stays repeatable.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(login).toHaveValue("@E2E_Enter_Check");
});
