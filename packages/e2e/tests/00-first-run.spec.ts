import { expect, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { signIn } from "./helpers";

// Runs first (one worker, files in name order) against the fresh database: the instance
// has no owner yet, so these are the only tests that ever see the claim page.
test.describe.configure({ mode: "serial" });

test("an unclaimed instance sends every visitor to the claim page", async ({ page, request }) => {
  // Signing in below claims the instance. A retry of this test after that has nothing left
  // to check: /setup is gone (404), and nothing short of a new database brings it back.
  const setup = await request.get("/setup");
  test.skip(setup.status() === 404, "the instance is already claimed (a retry after the claim)");

  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/setup`);
  await expect(page.getByRole("heading", { name: "This DireWork is all yours" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim with Twitch" })).toBeVisible();

  // The dashboard asks for a session, then the home page redirects on to the claim page.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/setup`);
});

test("the first sign-in claims the instance and turns the claim page off", async ({
  page,
  request,
}) => {
  // The first dev-login creates the owner, which claims the instance. A retry signs in that
  // same owner again, so everything below holds on a second attempt too.
  await signIn(page);

  // Signed out (the `request` fixture has its own cookie jar), the claim page no longer exists.
  const setup = await request.get("/setup");
  expect(setup.status()).toBe(404);

  // The owner lands on the dashboard, both from the claim page and from the home page.
  await page.goto("/setup");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
});
