import { expect, type Page, test } from "@playwright/test";

import { API_ORIGIN, DELAY_COOKIE, WEB_ORIGIN } from "../src/env";
import { expectNoHydrationErrors, signIn, watchHydration } from "./helpers";

// The dashboard loads progressively (apps/web/src/lib/progressive.ts): its data streams from
// ONE server batch, the first paint waits for it at most SECTIONS_READY_MS (800ms), and a
// section whose data is slower shows its placeholder and fills in on its own. The e2e api
// worker can slow named procedures (the `e2e-delay` cookie, src/api-entry.ts) and counts the
// requests it serves (`/__e2e/requests`), so both halves are checked against the real stack.

/** The one batched call the dashboard's server render makes. */
const DASHBOARD_BATCH = "/trpc/user.me,timer.get,config.get,task.list,stats.summary";

/**
 * Note, for every painted frame, the names of the section placeholders on screen. The check
 * runs in a task queued from each frame's rAF, so it sees the DOM as that frame painted it
 * (React reveals streamed content in an earlier rAF callback of the same frame).
 */
async function recordPlaceholderFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[][] = [];
    (window as unknown as { __placeholderFrames: string[][] }).__placeholderFrames = seen;
    const afterPaint = () => {
      const shown = [...document.querySelectorAll("main [data-placeholder]")]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => el.getAttribute("data-placeholder") ?? "?");
      if (shown.length > 0) seen.push(shown);
      if (performance.now() < 5000) requestAnimationFrame(() => setTimeout(afterPaint, 0));
    };
    requestAnimationFrame(() => setTimeout(afterPaint, 0));
  });
}

function placeholderFrames(page: Page): Promise<string[][]> {
  return page.evaluate(
    () => (window as unknown as { __placeholderFrames: string[][] }).__placeholderFrames,
  );
}

/** The api worker's request tally since the last call (and reset it). */
async function apiRequests(page: Page): Promise<Record<string, number>> {
  return (await page.request.get(`${API_ORIGIN}/__e2e/requests`)).json();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a fast hard load paints every section at once, never a placeholder", async ({ page }) => {
  // Warm the workers first: a cold start is not the case under test.
  await page.goto("/dashboard");
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard");
  await expectNoHydrationErrors(page);
  await expect(page.getByRole("textbox", { name: "New task text" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timer", exact: true })).toBeVisible();
  await page.waitForTimeout(500);

  expect(await placeholderFrames(page), "frames that showed a section placeholder").toEqual([]);
  // The same cost as before streaming: one session check and one batch.
  const served = await apiRequests(page);
  expect(served["/api/auth/get-session"]).toBe(1);
  expect(served[DASHBOARD_BATCH]).toBe(1);
});

test("a production-speed batch (every procedure ~300ms) still paints complete", async ({
  page,
  context,
}) => {
  // What production looks like: session read plus D1 round trips put the batch well past the
  // old 150ms deadline, which painted all three placeholders and filled them 300ms later.
  await context.addCookies([
    {
      name: DELAY_COOKIE,
      value: "user.me=300,timer.get=300,config.get=300,task.list=300,stats.summary=300",
      url: WEB_ORIGIN,
    },
  ]);
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard");
  await expectNoHydrationErrors(page);
  await expect(page.getByRole("textbox", { name: "New task text" })).toBeVisible();
  await page.waitForTimeout(500);

  expect(await placeholderFrames(page), "frames that showed a section placeholder").toEqual([]);
  const served = await apiRequests(page);
  expect(served["/api/auth/get-session"]).toBe(1);
  expect(served[DASHBOARD_BATCH]).toBe(1);

  await context.clearCookies({ name: DELAY_COOKIE });
});

test("a slow procedure holds back only its own section", async ({ page, context }) => {
  await context.addCookies([{ name: DELAY_COOKIE, value: "task.list=2500", url: WEB_ORIGIN }]);
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard", { waitUntil: "commit" });

  // Everything else is already on screen, with the task board's placeholder in its slot.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dev Streamer");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.locator('main [data-placeholder="tasks"]')).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New task text" })).toHaveCount(0);
  await expect(page.locator("main [data-placeholder]:visible")).toHaveCount(1);

  // Then the board fills in by itself, from the same request.
  await expect(page.getByRole("textbox", { name: "New task text" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("main [data-placeholder]")).toHaveCount(0);
  await expectNoHydrationErrors(page);

  const frames = await placeholderFrames(page);
  expect(frames.length, "the task board's placeholder was painted").toBeGreaterThan(0);
  expect([...new Set(frames.flat())], "no other section ever showed one").toEqual(["tasks"]);

  const served = await apiRequests(page);
  expect(served["/api/auth/get-session"]).toBe(1);
  expect(served[DASHBOARD_BATCH]).toBe(1);
  // The slow result rode the batch: no second fetch of task.list from the browser.
  expect(Object.keys(served).filter((path) => path.includes("task.list"))).toEqual([
    DASHBOARD_BATCH,
  ]);

  await context.clearCookies({ name: DELAY_COOKIE });
});

test("a slow stats.summary holds back only the stats strip and the focus chart", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: DELAY_COOKIE, value: "stats.summary=2500", url: WEB_ORIGIN }]);
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard", { waitUntil: "commit" });

  await expect(page.getByRole("textbox", { name: "New task text" })).toBeVisible();
  await expect(page.locator('main [data-placeholder="stats"]')).toBeVisible();
  await expect(page.locator('main [data-placeholder="focus-chart"]')).toBeVisible();
  await expect(page.locator("main [data-placeholder]:visible")).toHaveCount(2);

  await expect(page.getByRole("region", { name: "Today's stats" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("main [data-placeholder]")).toHaveCount(0);
  await expectNoHydrationErrors(page);
  expect([...new Set((await placeholderFrames(page)).flat())].sort()).toEqual([
    "focus-chart",
    "stats",
  ]);

  // The slow result rode the batch: the stats were never fetched on their own.
  const served = await apiRequests(page);
  expect(served[DASHBOARD_BATCH]).toBe(1);
  expect(Object.keys(served).filter((path) => path.includes("stats.summary"))).toEqual([
    DASHBOARD_BATCH,
  ]);

  await context.clearCookies({ name: DELAY_COOKIE });
});

// Bot settings opts into the same progressive loading: the (sections) layout streams
// `config.get` + `user.me` as one batch, and each card waits only for what it reads.

/** The one batched call every Bot settings server render makes. */
const BOT_BATCH = "/trpc/config.get,user.me";

test("Bot settings: a fast hard load paints every card at once, at the same request cost", async ({
  page,
}) => {
  await page.goto("/dashboard/bot");
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard/bot");
  await expectNoHydrationErrors(page);
  await expect(page.getByRole("switch", { name: "Mute bot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bot account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run the bot" })).toBeVisible();
  await page.waitForTimeout(500);

  expect(await placeholderFrames(page), "frames that showed a card placeholder").toEqual([]);
  // One session check and one batch, exactly as before streaming (no bot account here, so
  // the console card's URL query never runs).
  expect(await apiRequests(page)).toEqual({ "/api/auth/get-session": 1, [BOT_BATCH]: 1 });

  // A sub-page switch is a web-worker render only: the layout's data is already in hand.
  await page.getByRole("link", { name: "Commands", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Task commands" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await apiRequests(page)).toEqual({});
});

test("Bot settings: a slow config.get holds back only the live controls", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: DELAY_COOKIE, value: "config.get=2500", url: WEB_ORIGIN }]);
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  await page.goto("/dashboard/bot", { waitUntil: "commit" });

  // The account and console cards (user.me) are on screen; the live controls are not yet.
  await expect(page.getByRole("heading", { level: 1, name: "Bot settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect bot account" })).toBeVisible();
  await expect(page.locator('main [data-placeholder="live-controls"]')).toBeVisible();
  await expect(page.locator("main [data-placeholder]:visible")).toHaveCount(1);
  await expect(page.getByRole("switch", { name: "Mute bot" })).toHaveCount(0);

  // Then the card fills in by itself, from the same request.
  await expect(page.getByRole("switch", { name: "Mute bot" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("main [data-placeholder]")).toHaveCount(0);
  await expectNoHydrationErrors(page);

  const frames = await placeholderFrames(page);
  expect(frames.length, "the live controls' placeholder was painted").toBeGreaterThan(0);
  expect([...new Set(frames.flat())], "no other card ever showed one").toEqual(["live-controls"]);
  // The slow result rode the batch: no second config.get from the browser.
  expect(await apiRequests(page)).toEqual({ "/api/auth/get-session": 1, [BOT_BATCH]: 1 });

  await context.clearCookies({ name: DELAY_COOKIE });
});

test("Bot settings: a slow user.me holds back only the cards that read it", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: DELAY_COOKIE, value: "user.me=2500", url: WEB_ORIGIN }]);
  await recordPlaceholderFrames(page);
  watchHydration(page);
  await apiRequests(page);

  // Commands reads config.get only, so it never waits for the user.
  await page.goto("/dashboard/bot/commands", { waitUntil: "commit" });
  await expect(page.getByRole("switch", { name: "Task commands" })).toBeVisible();
  await expect(page.locator("main [data-placeholder]")).toHaveCount(0);
  await expectNoHydrationErrors(page);
  expect(await placeholderFrames(page), "Commands never showed a placeholder").toEqual([]);
  expect(await apiRequests(page)).toEqual({ "/api/auth/get-session": 1, [BOT_BATCH]: 1 });

  // The Overview's arrangement depends on the bot account, so all three of its cards wait,
  // then fill in from the same request.
  await page.goto("/dashboard/bot", { waitUntil: "commit" });
  await expect(page.locator('main [data-placeholder="bot-account"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect bot account" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("switch", { name: "Mute bot" })).toBeVisible();
  await expect(page.locator("main [data-placeholder]")).toHaveCount(0);
  await expectNoHydrationErrors(page);
  expect([...new Set((await placeholderFrames(page)).flat())].sort()).toEqual([
    "bot-account",
    "bot-console",
    "live-controls",
  ]);
  expect(await apiRequests(page)).toEqual({ "/api/auth/get-session": 1, [BOT_BATCH]: 1 });

  await context.clearCookies({ name: DELAY_COOKIE });
});
