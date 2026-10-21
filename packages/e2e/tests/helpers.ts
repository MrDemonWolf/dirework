import { expect, type Page } from "@playwright/test";

import { DEV_LOGIN_SECRET } from "../src/env";

/**
 * Mint an owner session through the DEV_LOGIN bypass. The request goes through the web
 * origin's /api/auth proxy, so the session cookie lands on the web origin exactly like a
 * real sign-in; `page.request` shares the page's cookie jar. On the fresh e2e database the
 * first call creates the owner, which claims the instance (00-first-run.spec.ts checks the
 * claim page before that happens); every later call signs in that same owner.
 */
export async function signIn(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/dev-login", {
    headers: { "content-type": "application/json", "x-dev-login-secret": DEV_LOGIN_SECRET },
    data: {},
  });
  expect(res.ok(), `dev-login answered ${res.status()}`).toBe(true);
}

/**
 * Reveal a masked URL row (SecretUrlRow) by its label and return the full URL. Show is a
 * toggle, and the row reveals itself after a reset, so Show is only pressed while the URL
 * is still hidden.
 */
export async function revealSecretUrl(page: Page, label: string): Promise<string> {
  const show = page.getByRole("button", { name: `Show ${label} URL` });
  if ((await show.getAttribute("aria-pressed")) !== "true") {
    await show.click();
  }
  // The row's Show/Copy/Reset buttons carry the same words in their labels; the revealed
  // value is the one textbox named exactly "<label> URL".
  return page.getByRole("textbox", { name: `${label} URL`, exact: true }).inputValue();
}

/** Press the named button in the open confirm dialog (ConfirmDialog renders an alertdialog). */
export async function confirmDialog(page: Page, label: string): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
}
