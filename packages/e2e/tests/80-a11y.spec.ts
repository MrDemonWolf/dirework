import { expect, test } from "@playwright/test";

import { expectNoSeriousViolations, signIn } from "./helpers";

// The dashboard panels fade in for ~0.75s after the heading appears, and axe blends that
// transient opacity into the colors it measures. The app turns its animations off under
// reduced motion, so the scan sees the colors a visitor sees at rest.
test.use({ reducedMotion: "reduce" });

// Signed out: the owner never sees the home page (they are sent on to the dashboard).
test("the home page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page, "home");
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // Each page renders a skeleton until its data arrives, and its h1 only with the data, so
  // waiting for the heading means the real page is scanned, not placeholders.
  const pages: { path: string; heading: string | RegExp; name: string }[] = [
    { path: "/dashboard", heading: /Wolf Streamer/, name: "dashboard" },
    { path: "/dashboard/styles", heading: "Theme Center", name: "theme-center" },
    { path: "/dashboard/bot", heading: "Bot settings", name: "bot-settings" },
    { path: "/dashboard/bot/commands", heading: "Bot settings", name: "bot-commands" },
    { path: "/dashboard/bot/replies", heading: "Bot settings", name: "bot-replies" },
    { path: "/dashboard/bot/moderation", heading: "Bot settings", name: "bot-moderation" },
  ];

  for (const { path, heading, name } of pages) {
    test(`${path} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoSeriousViolations(page, name);
    });
  }
});
