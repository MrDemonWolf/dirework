import { DEFAULT_PHASE_LABELS } from "@dirework/api/config-defaults";
import { expect, test } from "@playwright/test";

import { confirmDialog, revealSecretUrl, signIn } from "./helpers";

/** Digits of a work phase that has just begun: 25:00 counting down through 24:xx. */
const FRESH_WORK_DIGITS = /^2[45]:[0-5]\d$/;

test("starts a session, shows it ticking on the timer overlay, and stops it", async ({
  page,
  context,
}) => {
  // Start runs a short "starting" countdown (5s by default) before the work phase, and the
  // overlay is a second page: more than the default 30s budget.
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/dashboard");

  // Idempotent: a retry, or an earlier run that stopped partway, can leave a session
  // running, and the Start button only exists while the timer is idle.
  const start = page.getByRole("button", { name: "Start", exact: true });
  const stop = page.getByRole("button", { name: "Stop timer" });
  await expect(start.or(stop)).toBeVisible();
  if (await stop.isVisible()) {
    await stop.click();
    await confirmDialog(page, "Stop timer");
    await expect(start).toBeVisible();
  }

  await start.click();

  // The live region announces the phase; it reads the work phase once the starting
  // countdown has run out and the dashboard poll has picked the change up.
  const announcement = page.getByRole("status").filter({ hasText: "Timer:" });
  await expect(announcement).toHaveText(`Timer: ${DEFAULT_PHASE_LABELS.work}`, {
    timeout: 20_000,
  });
  await expect(page.getByRole("img", { name: "Pomodoro 1 of 4" })).toBeVisible();
  await expect(page.getByText(FRESH_WORK_DIGITS)).toBeVisible();

  // The overlay polls the api directly with its token and counts down locally between polls.
  const overlayUrl = await revealSecretUrl(page, "Timer overlay");
  const overlay = await context.newPage();
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(DEFAULT_PHASE_LABELS.work)).toBeVisible();
  const digits = overlay.getByText(FRESH_WORK_DIGITS);
  await expect(digits).toBeVisible();
  await expect(overlay.getByText("1/4")).toBeVisible();

  // Sampled a little over a second apart, the digits must have moved on.
  const sample = (await digits.textContent()) ?? "";
  expect(sample).toMatch(FRESH_WORK_DIGITS);
  await overlay.waitForTimeout(1500);
  await expect(digits).not.toHaveText(sample);
  await overlay.close();

  await stop.click();
  await confirmDialog(page, "Stop timer");
  await expect(start).toBeVisible();
});
