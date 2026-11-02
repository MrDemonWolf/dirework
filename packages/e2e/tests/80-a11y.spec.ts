import { devices, expect, type Page, test } from "@playwright/test";

import {
  expectNoSeriousViolations,
  pinTheme,
  signIn,
  type Theme,
  waitForHydration,
} from "./helpers";

// axe (WCAG 2.0/2.1/2.2 A + AA, see helpers.ts) over every page and the interactive states a
// visitor can open — menus with a keyboard-focused item, confirm dialogs, the live preview —
// in both themes and at desktop and phone widths. Serious and critical findings fail; the
// rest are reported as annotations. /setup is scanned in 00-first-run (the only spec that
// sees an unclaimed instance), the Bot settings screens with a connected bot in
// 27-bot-page-handoff.
//
// The dashboard panels fade in for ~0.75s after the heading appears, and axe blends that
// transient opacity into the colors it measures. The app turns its animations off under
// reduced motion, so the scan sees the colors a visitor sees at rest.
test.use({ reducedMotion: "reduce" });

const THEMES: Theme[] = ["dark", "light"];

// Each page renders a skeleton until its data arrives, and its h1 only with the data, so
// waiting for the heading means the real page is scanned, not placeholders.
const PAGES: { path: string; heading: string | RegExp; name: string }[] = [
  { path: "/dashboard", heading: /Wolf Streamer/, name: "dashboard" },
  { path: "/dashboard/styles", heading: "Theme Center", name: "theme-center" },
  { path: "/dashboard/bot", heading: "Bot settings", name: "bot-settings" },
  { path: "/dashboard/bot/commands", heading: "Bot settings", name: "bot-commands" },
  { path: "/dashboard/bot/replies", heading: "Bot settings", name: "bot-replies" },
  { path: "/dashboard/bot/moderation", heading: "Bot settings", name: "bot-moderation" },
];

/** The owner's overlay and bot page tokens, read the way the dashboard does. */
async function tokens(page: Page) {
  const me = await page.request.get("/rpc/user.me");
  expect(me.ok(), `user.me answered ${me.status()}`).toBe(true);
  const meData = (
    (await me.json()) as {
      result: { data: { overlayTimerToken: string; overlayTasksToken: string } };
    }
  ).result.data;
  const bot = await page.request.get("/rpc/bot.getIngestInfo");
  expect(bot.ok(), `bot.getIngestInfo answered ${bot.status()}`).toBe(true);
  const botToken = ((await bot.json()) as { result: { data: { botToken: string } } }).result.data
    .botToken;
  return { timer: meData.overlayTimerToken, tasks: meData.overlayTasksToken, bot: botToken };
}

async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await waitForHydration(page);
}

/** Make sure the board has a task, so its row menu and Clear all exist. */
async function ensureTask(page: Page): Promise<string> {
  const text = "a11y scan task";
  const row = page.getByRole("listitem").filter({ hasText: text });
  if ((await row.count()) === 0) {
    await page.getByRole("textbox", { name: "New task text" }).fill(text);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(row.first()).toBeVisible();
  }
  return text;
}

/**
 * Every Tab stop on the page must show a focus indicator: an outline, a box-shadow ring, or
 * a border that changes when it gains focus (WCAG 2.4.7). Ring/outline colors are held to
 * ≥ 3:1 against the surfaces they sit on by tokens-contrast.test.ts (1.4.11).
 */
async function expectVisibleFocusOnEveryStop(page: Page, name: string, maxStops = 120) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator("body").focus();
  const missing: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const focused = getComputedStyle(el);
      const describe = `${el.tagName.toLowerCase()}[${
        el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? ""
      }]`;
      const id = `${describe}@${Math.round(el.getBoundingClientRect().top + window.scrollY)}`;
      const outline =
        focused.outlineStyle !== "none" && Number.parseFloat(focused.outlineWidth) > 0;
      const ring = focused.boxShadow !== "none" && focused.boxShadow !== "";
      // An inner element that draws the ring for a visually hidden control (switch, radio).
      const within = [...(el.parentElement?.querySelectorAll("*") ?? [])].some((node) => {
        if (node === el) return false;
        const style = getComputedStyle(node);
        return (
          (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) ||
          (style.boxShadow !== "none" && style.boxShadow.includes("0px 0px 0px"))
        );
      });
      const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const parentRing =
        parent !== null &&
        ((parent.outlineStyle !== "none" && Number.parseFloat(parent.outlineWidth) > 0) ||
          (parent.boxShadow !== "none" && parent.boxShadow !== ""));
      return { id, describe, visible: outline || ring || parentRing || within };
    });
    if (!stop) break;
    if (seen.has(stop.id)) break;
    seen.add(stop.id);
    if (!stop.visible) missing.push(stop.describe);
  }
  expect(seen.size, `${name}: Tab reached no controls`).toBeGreaterThan(0);
  expect(missing, `${name}: focused controls without a visible indicator`).toEqual([]);
}

test("the home page has no serious accessibility violations, in either theme", async ({ page }) => {
  // Signed out: the owner never sees the home page (they are sent on to the dashboard).
  for (const theme of THEMES) {
    await pinTheme(page, theme);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page, `home-${theme}`, { theme });
  }
});

for (const theme of THEMES) {
  test.describe(`signed in, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await pinTheme(page, theme);
      await signIn(page);
    });

    for (const { path, heading, name } of PAGES) {
      test(`${path} has no serious accessibility violations`, async ({ page }) => {
        await openPage(page, path, heading);
        await expectNoSeriousViolations(page, `${name}-${theme}`, { theme });
      });
    }

    test("open menus, dialogs and the live preview have no serious violations", async ({
      page,
    }) => {
      await openPage(page, "/dashboard", /Wolf Streamer/);
      const task = await ensureTask(page);

      // Account menu opened from the keyboard, so its item has keyboard focus (focus ring).
      await page.getByRole("button", { name: /Account menu/ }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
      await expectNoSeriousViolations(page, `user-menu-${theme}`, { theme });
      await page.keyboard.press("Escape");

      // Task board options (destructive Clear done / Clear all), keyboard-opened.
      await page.getByRole("button", { name: "Task board options" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menu")).toBeVisible();
      await expectNoSeriousViolations(page, `board-menu-${theme}`, { theme });

      // Its Clear all confirm dialog, then cancel.
      await page.getByRole("menuitem", { name: /^Clear all/ }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoSeriousViolations(page, `confirm-dialog-${theme}`, { theme });
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("alertdialog")).toBeHidden();

      // A row's ⋯ menu (status actions, Remove).
      await page
        .getByRole("button", { name: `Actions for "${task}"` })
        .first()
        .click();
      await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
      await expectNoSeriousViolations(page, `row-menu-${theme}`, { theme });
      await page.keyboard.press("Escape");

      // The live preview as the console's side column (lg and up).
      await page.getByRole("button", { name: "Live preview of the timer overlay" }).click();
      await expect(page.getByRole("complementary", { name: "Live preview" })).toBeVisible();
      await expectNoSeriousViolations(page, `live-preview-${theme}`, { theme });

      // Theme Center: the Theme options menu, then the unsaved-changes guard.
      await openPage(page, "/dashboard/styles", "Theme Center");
      await page.getByRole("button", { name: "Theme options" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menu")).toBeVisible();
      await expectNoSeriousViolations(page, `theme-menu-${theme}`, { theme });
      await page.keyboard.press("Escape");

      const unchecked = page
        .getByRole("radiogroup", { name: "Theme presets" })
        .locator('[role="radio"][aria-checked="false"]')
        .first();
      await unchecked.click();
      await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
      const guard = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
      await expect(guard).toBeVisible();
      await expectNoSeriousViolations(page, `unsaved-guard-${theme}`, { theme });
      await guard.getByRole("button", { name: "Stay" }).click();
    });

    test("overlays and the bot widget and dock have no serious violations", async ({ page }) => {
      const t = await tokens(page);
      // Overlays and the widget are transparent; OBS composites them over the scene. Scan
      // them over a dark scene, the way they are seen, instead of the browser's white canvas.
      for (const [path, name] of [
        [`/overlay/t/${t.timer}`, "timer-overlay"],
        [`/overlay/l/${t.tasks}`, "tasks-overlay"],
        [`/bot/${t.bot}`, "bot-widget"],
      ] as const) {
        await page.goto(path);
        await page.addStyleTag({ content: "html{background:#18181b!important}" });
        // Each renders nothing until its first payload; then text (the widget's is sr-only).
        await page.waitForFunction(() => (document.body.textContent ?? "").trim().length > 0);
        await expectNoSeriousViolations(page, `${name}-${theme}`, { theme: "none" });
      }
      await page.goto(`/bot/${t.bot}?view=dock`);
      await expect(page.getByRole("main", { name: "DireWork bot dock" })).toBeVisible();
      await expectNoSeriousViolations(page, `bot-dock-${theme}`, { theme });
    });
  });
}

test.describe("phone width", () => {
  const { defaultBrowserType: _ignored, ...pixel } = devices["Pixel 7"];
  test.use({ ...pixel });

  for (const theme of THEMES) {
    test(`every page and the phone menu have no serious violations (${theme})`, async ({
      page,
    }) => {
      await pinTheme(page, theme);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page, `home-phone-${theme}`, { theme });

      await signIn(page);
      for (const { path, heading, name } of PAGES) {
        await openPage(page, path, heading);
        await expectNoSeriousViolations(page, `${name}-phone-${theme}`, { theme });
      }
      // The hamburger nav, open.
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
      await expectNoSeriousViolations(page, `phone-nav-${theme}`, { theme });
    });
  }
});

test.describe("keyboard focus", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const { path, heading, name } of PAGES.slice(0, 3)) {
    test(`every Tab stop on ${path} shows a focus indicator`, async ({ page }) => {
      await openPage(page, path, heading);
      await expectVisibleFocusOnEveryStop(page, name);
    });
  }
});

test("reduced motion leaves no animation running", async ({ page }) => {
  await signIn(page);
  await openPage(page, "/dashboard", /Wolf Streamer/);
  // Infinite pulses (LED chips, skeletons) and long reveals must all be cut to one instant
  // pass by index.css's reduced-motion gate.
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          animation.playState === "running" &&
          (timing?.iterations === Number.POSITIVE_INFINITY || Number(timing?.duration ?? 0) > 1)
        );
      })
      .map((animation) => (animation as CSSAnimation).animationName ?? animation.id),
  );
  expect(running, "animations still running under prefers-reduced-motion").toEqual([]);
});
