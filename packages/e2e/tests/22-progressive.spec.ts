import { expect, type Page, test } from "@playwright/test";

import { API_ORIGIN, DELAY_COOKIE, WEB_ORIGIN } from "../src/env";
import { expectNoHydrationErrors, signIn, watchHydration } from "./helpers";

// The dashboard loads progressively (apps/web/src/lib/progressive.ts): its data streams from
// ONE server batch, the first paint waits for it at most SECTIONS_READY_MS (150ms), and a
// section whose data is slower shows its placeholder and fills in on its own. The e2e api
// worker can slow named procedures (the `e2e-delay` cookie, src/api-entry.ts) and counts the
// requests it serves (`/__e2e/requests`), so both halves are checked against the real stack.

/** The one batched call the dashboard's server render makes. */
const DASHBOARD_BATCH = "/trpc/user.me,timer.get,config.get,task.list";

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
  await expect(page.getByRole("heading", { name: "Pomodoro" })).toBeVisible();
  await page.waitForTimeout(500);

  expect(await placeholderFrames(page), "frames that showed a section placeholder").toEqual([]);
  // The same cost as before streaming: one session check and one batch.
  const served = await apiRequests(page);
  expect(served["/api/auth/get-session"]).toBe(1);
  expect(served[DASHBOARD_BATCH]).toBe(1);
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
