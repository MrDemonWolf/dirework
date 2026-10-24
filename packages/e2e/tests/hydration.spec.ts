import { expect, test } from "@playwright/test";

import { expectNoHydrationErrors, signIn, waitForHydration, watchHydration } from "./helpers";

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

// next-themes' context flips right after hydration when the OS scheme differs from the app
// theme (dark by default). That update once reached the streamed page before React revealed
// it, so React silently client-rendered the page beside its own server HTML. Both schemes,
// every prefetched page.
for (const colorScheme of ["light", "dark"] as const) {
  for (const path of [
    "/dashboard",
    "/dashboard/styles",
    "/dashboard/bot",
    "/dashboard/bot/commands",
    "/dashboard/bot/moderation",
  ]) {
    test(`${path} hydrates its server HTML on a ${colorScheme} OS`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      watchHydration(page);
      await page.goto(path);
      await expectNoHydrationErrors(page);
    });
  }
}

// The race above depends on timing: it failed every CI attempt but only some local loads.
// React batches streamed reveals (`$RV`, run up to ~300ms after first paint); holding that
// reveal back makes the window wide and the check deterministic. Hydration must still win.
test("the dashboard hydrates even when React's streamed reveal is held back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    let reveal: ((batch: unknown[]) => void) | undefined;
    Object.defineProperty(window, "$RV", {
      configurable: true,
      get: () => reveal,
      set: (fn: (batch: unknown[]) => void) => {
        reveal = (batch) => setTimeout(() => fn(batch), 1_000);
      },
    });
  });
  watchHydration(page);
  await page.goto("/dashboard");
  await expectNoHydrationErrors(page);
  await expect(page.getByRole("textbox", { name: "New task text" })).toHaveCount(1);
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

// Each Bot settings sub-page holds its own draft, so leaving one through the sub-nav with
// unsaved edits must ask first, and "Stay" must keep the edits.
test("switching Bot settings sub-pages with unsaved edits asks first", async ({ page }) => {
  await page.goto("/dashboard/bot/commands");
  await waitForHydration(page);

  await page.getByRole("tab", { name: "Aliases" }).click();
  await page.getByRole("button", { name: "Add alias" }).click();
  await page.getByLabel("Alias", { exact: true }).last().fill("e2eguard");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Bot settings sections" });
  await nav.getByRole("link", { name: "Moderation" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard\/bot\/commands$/);
  await expect(page.getByLabel("Alias", { exact: true }).last()).toHaveValue("e2eguard");

  await nav.getByRole("link", { name: "Moderation" }).click();
  await dialog.getByRole("button", { name: "Discard and leave" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bot\/moderation$/);
  await expect(page.getByRole("heading", { name: "Blocked viewers" })).toBeVisible();
});
