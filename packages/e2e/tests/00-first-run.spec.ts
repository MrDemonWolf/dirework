import { type APIRequestContext, expect, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { signIn } from "./helpers";

const CLAIM_HEADING = "This DireWork is all yours";

/** True when a signed-out GET /setup renders the claim page (the instance has no owner). */
async function servesClaimPage(request: APIRequestContext): Promise<boolean> {
  const res = await request.get("/setup");
  return res.status() === 200 && (await res.text()).includes(CLAIM_HEADING);
}

// Runs first (one worker, files in name order) against the fresh database: the instance
// has no owner yet, so these are the only tests that ever see the claim page.
test.describe.configure({ mode: "serial" });

test("an unclaimed instance sends every visitor to the claim page", async ({ page, request }) => {
  // Signing in below claims the instance. A retry of this test after that has nothing left
  // to check: the claim page is gone, and nothing short of a new database brings it back. On
  // the first attempt the database is fresh, so a missing claim page is a real regression
  // and must fail rather than skip. The body is checked, not the status: the (app) route
  // group streams its loading shell first, so a notFound() thrown later in the page still
  // arrives with status 200.
  const claimPage = await servesClaimPage(request);
  if (test.info().retry > 0) {
    test.skip(!claimPage, "the instance is already claimed (a retry after the claim)");
  }
  expect(claimPage, "a fresh instance must serve the claim page").toBe(true);

  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/setup`);
  await expect(page.getByRole("heading", { name: CLAIM_HEADING })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim with Twitch" })).toBeVisible();

  // A sign-in that bounces back with `?error=` shows its notice, and the query is dropped so
  // a refresh doesn't show it again. (`instance_claimed` can't land here: once claimed, this
  // page is gone.)
  await page.goto("/setup?error=not_owner");
  await expect(
    page.getByRole("alert").filter({ hasText: "Only this DireWork's owner can connect" }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${WEB_ORIGIN}/setup`);
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
  expect(await servesClaimPage(request)).toBe(false);

  // The owner lands on the dashboard, both from the claim page and from the home page.
  await page.goto("/setup");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
});
