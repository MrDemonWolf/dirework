import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

// A hard load of /dashboard streams the finished page: the server prefetches the session,
// timer, tasks and config in one batched call, so the browser makes no /rpc request and no
// client session fetch before the page is usable.

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the dashboard HTML arrives with its data, nav and no skeleton in the page", async ({
  page,
}) => {
  const res = await page.request.get("/dashboard");
  expect(res.ok()).toBe(true);
  const html = await res.text();

  expect(html).toContain("Dev Streamer");
  expect(html).toContain('aria-label="New task text"');
  expect(html).toContain("Tasks overlay URL");
  expect(html).toContain('aria-label="Open menu"');
  expect(html).toContain("Theme Center");

  // The route's loading.tsx fallbacks still stream ahead of the page (Next's streaming
  // model), but the page itself must arrive finished: the streamed segment that holds the
  // dashboard (React's `<div hidden id="S:n">…</div><script>` swap-in) renders no skeleton,
  // i.e. neither the user.me fallback nor the task list's pending state.
  const segments = [...html.matchAll(/<div hidden id="S:\d+">/g)].map((m) =>
    html.slice(m.index, html.indexOf("<script", m.index)),
  );
  const dashboard = segments.find((segment) => segment.includes('aria-label="New task text"'));
  expect(dashboard, "the dashboard segment is in the streamed HTML").toBeDefined();
  expect(dashboard).toContain("Tasks overlay URL");
  expect(dashboard).not.toContain('data-slot="skeleton"');
});

test("a hard load needs no client fetch before the first poll", async ({ page }) => {
  let rpc = 0;
  let getSession = 0;
  page.on("request", (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.startsWith("/rpc")) rpc++;
    if (pathname === "/api/auth/get-session") getSession++;
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  expect(rpc).toBe(0);
  expect(getSession).toBe(0);

  // Polling still runs on its normal cadence once the page is up.
  await expect.poll(() => rpc, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(getSession).toBe(0);
});
