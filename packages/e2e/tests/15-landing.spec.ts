import { expect, test } from "@playwright/test";

import { API_ORIGIN, WEB_ORIGIN } from "../src/env";
import { recordSkeletonFrames, setApiDelay, signIn, skeletonFrames } from "./helpers";

// The home page of a claimed instance (00-first-run claimed it) as a signed-out visitor sees
// it: a static viewer landing that points at deploying your own copy. The last test is the
// owner's view: no landing at all, a redirect to the dashboard.

test("a refused sign-in shows the claimed notice with a link to deploy your own", async ({
  page,
}) => {
  await page.goto("/?error=instance_claimed");

  // Filtered by its text: Next's route announcer is an (empty) alert too.
  const notice = page
    .getByRole("alert")
    .filter({ hasText: "already belongs to a different Twitch account" });
  await expect(notice).toBeVisible();
  const deploy = notice.getByRole("link", { name: /Deploy your own/ });
  await expect(deploy).toHaveAttribute("href", /\/docs\/deployment$/);

  // The code is stripped from the address bar so a refresh doesn't re-show the notice.
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
});

test("Deploy your own points at the deployment docs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deploy your own", exact: true })).toHaveAttribute(
    "href",
    /^https:\/\/.+\/docs\/deployment$/,
  );
  await expect(page.getByRole("link", { name: "Read the docs" })).toHaveAttribute(
    "href",
    /^https:\/\/.+\/docs$/,
  );
  await expect(page.getByRole("button", { name: "Sign in with Twitch" })).toBeVisible();
});

test("the landing page makes no tRPC requests", async ({ page }) => {
  const rpc: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/rpc") || pathname.startsWith("/trpc")) rpc.push(pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(rpc).toEqual([]);
});

test("a cookie-less visitor's landing costs the api no request", async ({ page }) => {
  // No better-auth session cookie means no session to look up, so getServerSession answers
  // null itself. And once the web isolate has seen the instance claimed, `/` stops asking
  // `user.hasOwner` (getInstanceOwnedLatched): the landing costs the api nothing.
  const tally = async (): Promise<Record<string, number>> =>
    (await page.request.get(`${API_ORIGIN}/__e2e/requests`)).json();
  // One load that may still have to ask (this spec run alone, on a fresh web worker) latches it.
  expect((await page.request.get("/", { maxRedirects: 0 })).status()).toBe(200);
  await tally();
  const res = await page.request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await tally()).toEqual({});
});

test("the first HTML response already holds the finished landing", async ({ page }) => {
  // No loading.tsx wraps / (AGENTS.md "Shell hold"), so nothing streams until the page's
  // ownership and session checks answer, and the landing is written straight into <main>.
  // With one, <main> held the skeleton and the landing came after the shell in a hidden
  // segment, for React to swap in.
  const res = await page.request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const main = (await res.text()).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
  expect(main).toMatch(/<h1\b/);
  expect(main).not.toContain('data-slot="skeleton"');
});

test("a hard load paints the finished landing, never the loading skeleton", async ({ page }) => {
  // The ownership check (`user.hasOwner`) is slowed so it answers well after the (app)
  // layout's session check (in production it trailed by 80-100ms; on localhost the two land
  // within a frame of each other, too close for a paint in between). A loading boundary would
  // stream its skeleton in that gap; with none, the first paint waits for the whole page. By
  // now this web worker has latched the claim, so `/` skips the check; the delay is kept so
  // the test still covers that gap on a fresh isolate's first load (or if the latch goes).
  await setApiDelay(page, "user.hasOwner=1500");
  try {
    await recordSkeletonFrames(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await skeletonFrames(page), "frames that showed the loading skeleton").toEqual([]);
  } finally {
    await setApiDelay(page, null);
  }
});

test("the owner's / is a real redirect to the dashboard", async ({ page }) => {
  // The page decides before anything streams, so redirect() is an HTTP 307 and the browser
  // loads /dashboard directly (which paints finished). Behind a streamed loading skeleton it
  // was a 200 that redirected client-side, into the dashboard's own loading state: two
  // loading states on the way in.
  await signIn(page);
  const res = await page.request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toMatch(/\/dashboard$/);
});
