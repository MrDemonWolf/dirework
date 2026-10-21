import { expect, test } from "@playwright/test";

import { confirmDialog, revealSecretUrl, signIn } from "./helpers";

/** Any timer digits; while idle the overlay previews the full work length (25:00). */
const CLOCK_DIGITS = /^\d{2}:\d{2}$/;

test("resetting the timer overlay URL blanks the old overlay and the new URL works", async ({
  page,
  context,
}) => {
  // Two overlay pages plus a wait for the old one's next poll: more than the default 30s.
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/dashboard");

  const oldUrl = await revealSecretUrl(page, "Timer overlay");
  const oldOverlay = await context.newPage();
  await oldOverlay.goto(oldUrl);
  await expect(oldOverlay.getByText(CLOCK_DIGITS)).toBeVisible();

  await page.getByRole("button", { name: "Reset Timer overlay URL" }).click();
  await confirmDialog(page, "Reset URL");
  await expect(page.getByText("New overlay URL ready — paste it into OBS")).toBeVisible();

  // The old token is dead: its next poll (every 3s) answers null and the page renders
  // nothing, so a stale OBS source goes transparent instead of showing a fake timer.
  await expect(oldOverlay.getByText(CLOCK_DIGITS)).toHaveCount(0);
  await oldOverlay.close();

  // The row stays revealed and swaps to the new URL once the dashboard has refetched it.
  const urlField = page.getByRole("textbox", { name: "Timer overlay URL", exact: true });
  await expect(urlField).not.toHaveValue(oldUrl);
  const newUrl = await revealSecretUrl(page, "Timer overlay");
  expect(newUrl).not.toBe(oldUrl);

  const newOverlay = await context.newPage();
  await newOverlay.goto(newUrl);
  await expect(newOverlay.getByText(CLOCK_DIGITS)).toBeVisible();
  await newOverlay.close();
});
