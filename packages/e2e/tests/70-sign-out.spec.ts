import { expect, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { signIn } from "./helpers";

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
