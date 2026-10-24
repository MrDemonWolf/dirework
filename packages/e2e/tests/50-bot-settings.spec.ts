import { expect, test } from "@playwright/test";

import { signIn, waitForHydration } from "./helpers";

test("edits a reply, previews it as chat would show it, saves, and resets it", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot/commands");
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
  await page.goto("/dashboard/bot/commands");
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

  // Overview → Moderation through the Live controls' link.
  await page.getByRole("link", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bot\/moderation$/);
  await expect(
    page
      .getByRole("navigation", { name: "Bot settings sections" })
      .getByRole("link", { name: "Moderation" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/^\d+ of 200$/)).toBeVisible();
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

test("a fresh instance's mute bar does not claim the bot is live", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  // No bot account is connected in e2e, so nothing can answer chat: the bar says so.
  await expect(page.getByText("Connect a bot account first.", { exact: false })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
  // The switch still works there (pre-mute), under its own label.
  await expect(page.getByRole("switch", { name: "Mute bot" })).toBeEnabled();
  // The console card only promises a URL, never a running bot.
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(0);
});

test("the sub-nav reaches every section and marks the current one", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  const nav = page.getByRole("navigation", { name: "Bot settings sections" });
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Live controls" })).toBeVisible();

  await nav.getByRole("link", { name: "Commands" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bot\/commands$/);
  await expect(nav.getByRole("link", { name: "Commands" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  await expect(page.getByRole("tab", { name: "Aliases" })).toBeVisible();

  await nav.getByRole("link", { name: "Moderation" }).click();
  await expect(page.getByRole("heading", { name: "Blocked viewers" })).toBeVisible();
  // The old in-page jump link is gone: Moderation is its own page now.
  await expect(page.getByRole("link", { name: "Jump to Moderation" })).toHaveCount(0);
});

test("a command group switch saves the moment it flips", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/bot");
  await waitForHydration(page);

  const timer = page.getByRole("switch", { name: "Timer commands" });
  // Put it back afterwards, so a retry starts from the same state.
  const before = await timer.isChecked();
  await timer.click();
  await expect(page.getByText(`Timer commands ${before ? "off" : "on"}`)).toBeVisible();
  // No Save bar: the switch is not a draft.
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);

  await page.reload();
  await waitForHydration(page);
  await expect(timer).toBeChecked({ checked: !before });
  await timer.click();
  await expect(timer).toBeChecked({ checked: before });
  await expect(timer).toBeEnabled();
});
