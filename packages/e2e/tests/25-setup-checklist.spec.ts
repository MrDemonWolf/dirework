import { expect, type Locator, type Page, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { confirmDialog, signIn } from "./helpers";

// The dashboard's "Set up streaming" checklist. The e2e owner never connects a bot account
// (dev-login creates none), so the baseline is 0 of 4. Each test puts the timer step back
// to "Not yet" before it starts, so a retry after a half-finished attempt passes too.
test.describe.configure({ mode: "serial" });

function checklist(page: Page): Locator {
  return page.getByRole("region", { name: "Set up streaming" });
}

function timerStep(page: Page): Locator {
  return checklist(page).getByRole("button", { name: /Add the timer overlay/ });
}

/** Open the timer step (an accordion row) if it is closed. */
async function openTimerStep(page: Page): Promise<void> {
  const row = timerStep(page);
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(checklist(page)).toBeVisible();
  await openTimerStep(page);
  const undo = checklist(page).getByRole("button", { name: "Mark as not added" });
  if (await undo.isVisible()) {
    await undo.click();
    await expect(timerStep(page)).toContainText("Not yet");
  }
});

test("confirming the timer overlay step counts it, survives a reload, and reverts", async ({
  page,
}) => {
  const card = checklist(page);
  await expect(card.getByText("0 of 4")).toBeVisible();
  // Step 1 is detected, not confirmable: without a bot account it links to Bot settings.
  await expect(card.getByRole("button", { name: /Connect the bot account/ })).toContainText(
    "Not yet",
  );

  await card.getByRole("button", { name: "I added it to OBS" }).click();
  await expect(timerStep(page)).toContainText("Added (you confirmed)");
  await expect(card.getByText("1 of 4")).toBeVisible();

  // The flag is stored server-side, not just in the cache.
  await page.reload();
  await expect(card.getByText("1 of 4")).toBeVisible();
  await expect(timerStep(page)).toContainText("Added (you confirmed)");

  await openTimerStep(page);
  await card.getByRole("button", { name: "Mark as not added" }).click();
  await expect(timerStep(page)).toContainText("Not yet");
  await expect(card.getByText("0 of 4")).toBeVisible();

  await page.reload();
  await expect(card.getByText("0 of 4")).toBeVisible();
});

test("Finish later hides the card until the header's Setup button reopens it", async ({ page }) => {
  await checklist(page).getByRole("button", { name: "Finish later" }).click();
  await expect(checklist(page)).toHaveCount(0);
  const reopen = page.getByRole("button", { name: /^Setup/ });
  await expect(reopen).toBeFocused();

  // The choice is remembered in this browser.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(checklist(page)).toHaveCount(0);

  await page.getByRole("button", { name: /^Setup/ }).click();
  await expect(checklist(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set up streaming" })).toBeFocused();
});

test("Finish later still hides the card when the browser blocks storage", async ({ browser }) => {
  // A fresh context whose localStorage writes throw, like blocked site data.
  const context = await browser.newContext({ baseURL: WEB_ORIGIN });
  await context.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  const page = await context.newPage();
  await signIn(page);
  await page.goto("/dashboard");
  await checklist(page).getByRole("button", { name: "Finish later" }).click();
  await expect(checklist(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Setup/ }).click();
  await expect(checklist(page)).toBeVisible();
  await context.close();
});

test("resetting the timer overlay URL un-confirms its step", async ({ page }) => {
  const card = checklist(page);
  await card.getByRole("button", { name: "I added it to OBS" }).click();
  await expect(timerStep(page)).toContainText("Added (you confirmed)");

  // The copy in OBS stops working, so "added to OBS" no longer holds.
  await page.getByRole("button", { name: "Reset Timer overlay URL" }).click();
  await confirmDialog(page, "Reset URL");
  await expect(timerStep(page)).toContainText("Not yet");
  await expect(card.getByText("0 of 4")).toBeVisible();
});
