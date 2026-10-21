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

const HYDRATION_MESSAGE = /hydrat|Switched to client rendering|did not match/i;
const pageProblems = new WeakMap<Page, string[]>();

/**
 * Start collecting what would mean a page did not hydrate cleanly: every uncaught page error
 * (an inline script throwing, a crashed render) and every console error that mentions
 * hydration. Call it before `page.goto`; `expectNoHydrationErrors` asserts on the result.
 */
export function watchHydration(page: Page): void {
  if (pageProblems.has(page)) return;
  const problems: string[] = [];
  pageProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_MESSAGE.test(message.text())) {
      problems.push(`console: ${message.text()}`);
    }
  });
}

/**
 * Wait until React has hydrated the page, so the next fill or click reaches a React handler.
 * The server HTML already carries the editors with their saved values (the routes prefetch
 * their data), so a locator can resolve — and type — before React attaches: that input event
 * is lost, and a controlled value React then writes resets the caret, so a `fill` straddling
 * it appends instead of replacing. Call it after `page.goto` and before the first edit.
 */
export async function waitForHydration(page: Page): Promise<void> {
  // React's streamed segments (`<div hidden id="S:n">`) are gone once their reveal ran.
  await page.waitForFunction(() => !document.querySelector('body > div[hidden][id^="S:"]'));
  // The header's theme switch only mounts in an effect (a placeholder stands in before), so
  // its presence means the effects of the hydrated tree have run.
  await expect(page.getByRole("switch", { name: "Toggle dark mode" })).toBeVisible();
}

/**
 * Assert the page hydrated its server HTML instead of throwing it away. A production React
 * build bails out of hydration SILENTLY when an update reaches a streamed Suspense boundary
 * before its reveal (it just client-renders the boundary), so the console alone can't catch
 * that: once every streamed segment has been revealed, each Base UI id inside <main> must
 * still be a server-generated useId (`_R_…`), never a client one (`_r_…`). A client-rendered
 * copy is also how the dashboard briefly existed twice in the DOM.
 */
export async function expectNoHydrationErrors(page: Page): Promise<void> {
  // The header's theme switch mounts in the same effect flush that used to trigger the
  // bail-out, so by then the outcome is decided.
  await waitForHydration(page);
  const clientIds = await page.evaluate(() =>
    [...document.querySelectorAll('main [id^="base-ui-"]')]
      .map((element) => element.id)
      .filter((id) => id.includes("_r_")),
  );
  expect(clientIds, "server-rendered <main> was client-rendered instead of hydrated").toEqual([]);
  expect(pageProblems.get(page) ?? [], "page errors or hydration warnings").toEqual([]);
}

/** Press the named button in the open confirm dialog (ConfirmDialog renders an alertdialog). */
export async function confirmDialog(page: Page, label: string): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
}
