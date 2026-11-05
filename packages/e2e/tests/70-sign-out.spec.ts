import { expect, type Response, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { signIn, waitForHydration } from "./helpers";

/** An answer to the dashboard's authenticated tRPC (the web worker's /rpc proxy). */
function isRpc(url: string): boolean {
  return new URL(url).pathname.startsWith("/rpc/");
}

test("the account menu opens from the keyboard with the Docs and Report a problem links", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: /^Account menu/ }).focus();
  await page.keyboard.press("ArrowDown");

  // Both links open outside DireWork, in a new tab, without handing over the opener.
  const docs = page.getByRole("menuitem", { name: /^Docs/ });
  const report = page.getByRole("menuitem", { name: /^Report a problem/ });
  await expect(docs).toBeFocused();
  await expect(docs).toHaveAttribute("href", /\/docs$/);
  await expect(report).toHaveAttribute(
    "href",
    "https://github.com/mrdemonwolf/dirework/issues/new",
  );
  for (const link of [docs, report]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  // Arrow keys walk past the separator to Sign out; Escape hands focus back to the trigger.
  await page.keyboard.press("ArrowDown");
  await expect(report).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Account menu/ })).toBeFocused();
});

test("signing out returns to the home page and locks the dashboard again", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");

  // The account menu is labelled "Account menu — <owner name>".
  await page.getByRole("button", { name: /^Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  // A claimed instance shows its home page to a signed-out visitor.
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
  await expect(page.getByRole("button", { name: "Sign in with Twitch" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
});

test("an open dashboard whose sign-in lapses stops polling and asks for one reload", async ({
  page,
  context,
}) => {
  // 30 s of listening for polls, on top of the page load.
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/dashboard");
  await waitForHydration(page);
  // The timer and task polls are running.
  await page.waitForResponse((res: Response) => isRpc(res.url()) && res.ok());

  // The session ends somewhere else (signed out in another tab, revoked, an edge sign-in
  // that ran out): the browser stops sending it, and the next poll is refused.
  const refused = page.waitForResponse((res: Response) => isRpc(res.url()) && res.status() === 401);
  await context.clearCookies();
  await refused;
  // Let the page read that answer, then count every /rpc request it still sends. Polling
  // used to carry on: each poll tried four times, then started again a cycle later.
  await page.waitForTimeout(1000);
  const sent: string[] = [];
  page.on("request", (req) => {
    if (isRpc(req.url())) sent.push(new URL(req.url()).pathname);
  });
  await page.waitForTimeout(30_000);
  expect(sent, "/rpc requests after the sign-in lapsed").toEqual([]);

  // Exactly one toast says why, and it stays until the owner acts on it.
  const toasts = page.getByRole("region", { name: /^Notifications/ }).getByRole("listitem");
  await expect(toasts).toHaveCount(1);
  await expect(toasts).toContainText("Your sign-in expired");
  // Reload runs the server's session check again: a signed-out owner lands on the home page.
  await toasts.getByRole("button", { name: "Reload" }).click();
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
});
