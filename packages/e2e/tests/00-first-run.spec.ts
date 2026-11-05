import { type APIRequestContext, expect, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";
import { expectNoSeriousViolations, pinTheme, signIn } from "./helpers";

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
  // and must fail rather than skip.
  const claimPage = await servesClaimPage(request);
  if (test.info().retry > 0) {
    test.skip(!claimPage, "the instance is already claimed (a retry after the claim)");
  }
  expect(claimPage, "a fresh instance must serve the claim page").toBe(true);

  // No loading.tsx wraps / or /setup, so nothing streams before the page decides: / answers
  // a real 307 to the claim page instead of a 200 that redirects client-side later.
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(307);
  expect(home.headers().location).toMatch(/\/setup$/);

  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/setup`);
  await expect(page.getByRole("heading", { name: CLAIM_HEADING })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim with Twitch" })).toBeVisible();

  // The only run that can see the claim page, so its accessibility scan lives here (80-a11y
  // covers every other page), in both themes.
  await expectNoSeriousViolations(page, "setup-dark");
  await pinTheme(page, "light");
  await page.reload();
  await expect(page.getByRole("heading", { name: CLAIM_HEADING })).toBeVisible();
  await expectNoSeriousViolations(page, "setup-light", { theme: "light" });

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

  // Signed out (the `request` fixture has its own cookie jar), the claim page no longer exists:
  // a real 404, since nothing streams before the page decides.
  expect(await servesClaimPage(request)).toBe(false);
  expect((await request.get("/setup")).status()).toBe(404);

  // The owner lands on the dashboard, both from the claim page and from the home page. The
  // claim page's redirect is a real 307 (15-landing checks the home page's).
  const setup = await page.request.get("/setup", { maxRedirects: 0 });
  expect(setup.status()).toBe(307);
  expect(setup.headers().location).toMatch(/\/dashboard$/);
  await page.goto("/setup");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
  await page.goto("/");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/dashboard`);
});
