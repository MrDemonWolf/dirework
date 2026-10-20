import { expect, type Page } from "@playwright/test";

import { DEV_LOGIN_SECRET } from "../src/env";

/**
 * Mint an owner session through the DEV_LOGIN bypass. The request goes through the web
 * origin's /api/auth proxy, so the session cookie lands on the web origin exactly like a
 * real sign-in; `page.request` shares the page's cookie jar.
 */
export async function signIn(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/dev-login", {
    headers: { "content-type": "application/json", "x-dev-login-secret": DEV_LOGIN_SECRET },
    data: {},
  });
  expect(res.ok(), `dev-login answered ${res.status()}`).toBe(true);
}

/** Reveal a masked URL row (SecretUrlRow) by its label and return the full URL. */
export async function revealSecretUrl(page: Page, label: string): Promise<string> {
  await page.getByRole("button", { name: `Show ${label} URL` }).click();
  // The row's Show/Copy/Reset buttons carry the same words in their labels; the revealed
  // value is the one textbox named exactly "<label> URL".
  return page.getByRole("textbox", { name: `${label} URL`, exact: true }).inputValue();
}
