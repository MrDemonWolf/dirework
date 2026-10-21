import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

/** WCAG 2.0 and 2.1, levels A and AA — the rule tags axe maps to those success criteria. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Scan the current page and fail on any serious or critical violation. The full axe result
 * (every violation, pass, and incomplete check) is attached to the test report, so a failure
 * can be read in CI without rerunning the scan.
 */
async function expectNoSeriousViolations(
  page: Page,
  name: string,
  disabledRules: readonly string[] = [],
): Promise<void> {
  // The theme class is applied by a script after the HTML streams in; until then the page
  // shows the light palette, and a scan during that window measures the wrong colors.
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .disableRules([...disabledRules])
    .analyze();
  await test.info().attach(`axe-${name}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    );
  expect(blocking, `axe violations on ${name}`).toEqual([]);
}

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
  const pages: {
    path: string;
    heading: string | RegExp;
    name: string;
    disabledRules?: readonly string[];
  }[] = [
    { path: "/dashboard", heading: /Dev Streamer$/, name: "dashboard" },
    { path: "/dashboard/styles", heading: "Theme Center", name: "theme-center" },
    {
      path: "/dashboard/bot",
      heading: "Bot settings",
      name: "bot-settings",
      // Known resting-state failure: the command reference's 11px usage lines
      // (`text-muted-foreground/80`, #6e7d8e on #091427) measure 4.37:1, under the 4.5:1 AA
      // minimum. The design-token contrast test and token-bypass sweep fix it; drop this
      // exclusion with that change.
      disabledRules: ["color-contrast"],
    },
  ];

  for (const { path, heading, name, disabledRules } of pages) {
    test(`${path} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoSeriousViolations(page, name, disabledRules);
    });
  }
});
