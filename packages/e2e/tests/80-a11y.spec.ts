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
 * Inspect the focused element: does focusing it paint an indicator it does not have at rest?
 * Runs in the page. It snapshots the element and its two nearest ancestors (a wrapper that
 * draws a `focus-within` ring) while focused, blurs, snapshots again, then restores focus
 * (keyboard modality is kept, so `:focus-visible` comes back and the next Tab continues from
 * here). An indicator counts only when it is actually painted: an outline with a width and
 * a non-transparent color, or a box-shadow layer with a non-transparent color and a blur,
 * spread or offset — a `ring-0` shadow (`0px 0px 0px 0px`) or a transparent one is nothing.
 */
const inspectFocus = async () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  const frames = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  const alpha = (color: string) => {
    if (!color || color === "transparent") return 0;
    const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = /^rgba\(([^)]+)\)$/.exec(color);
    if (rgba) return Number(rgba[1]?.split(",")[3] ?? 1);
    return 1;
  };
  const COLOR = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[\da-f]{3,8}\b|transparent/i;
  const paintedShadows = (value: string) =>
    value === "none" || !value
      ? []
      : value
          .split(/,(?![^(]*\))/)
          .map((layer) => layer.trim())
          .filter((layer) => {
            const color = COLOR.exec(layer)?.[0] ?? "currentcolor";
            const [x = 0, y = 0, blur = 0, spread = 0] = (
              layer.replace(color, "").match(/-?[\d.]+px/g) ?? []
            ).map(Number.parseFloat);
            return alpha(color) > 0 && (blur > 0 || spread > 0 || x !== 0 || y !== 0);
          });
  const snap = (node: HTMLElement) => {
    const style = getComputedStyle(node);
    return {
      outline:
        style.outlineStyle !== "none" &&
        Number.parseFloat(style.outlineWidth) > 0 &&
        alpha(style.outlineColor) > 0
          ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`
          : "",
      shadow: paintedShadows(style.boxShadow).join(" | "),
      border:
        Number.parseFloat(style.borderTopWidth) > 0 && alpha(style.borderTopColor) > 0
          ? style.borderTopColor
          : "",
    };
  };
  const chain = [el, el.parentElement, el.parentElement?.parentElement].filter(
    (node): node is HTMLElement => node instanceof HTMLElement && node !== document.body,
  );
  await frames();
  const focused = chain.map(snap);
  el.blur();
  await frames();
  const rest = chain.map(snap);
  el.focus({ preventScroll: true });
  await frames();
  const visible = focused.some((f, i) => {
    const r = rest[i];
    return (
      (f.outline !== "" && f.outline !== r?.outline) ||
      (f.shadow !== "" && f.shadow !== r?.shadow) ||
      (f.border !== "" && f.border !== r?.border)
    );
  });
  const describe = `${el.tagName.toLowerCase()}[${
    el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? ""
  }]`;
  const id = `${describe}@${Math.round(el.getBoundingClientRect().top + window.scrollY)}`;
  return { id, describe, visible };
};

/** Tab through the page and return every stop that showed no focus indicator. */
async function stopsWithoutFocusIndicator(page: Page, maxStops = 120) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator("body").focus();
  const missing: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(inspectFocus);
    if (!stop || seen.has(stop.id)) break;
    seen.add(stop.id);
    if (!stop.visible) missing.push(stop.describe);
  }
  return { reached: seen.size, missing };
}

/**
 * Every Tab stop on the page must show a focus indicator (WCAG 2.4.7). Ring/outline colors
 * are held to ≥ 3:1 against the surfaces they sit on by tokens-contrast.test.ts (1.4.11).
 */
async function expectVisibleFocusOnEveryStop(page: Page, name: string) {
  const { reached, missing } = await stopsWithoutFocusIndicator(page);
  expect(reached, `${name}: Tab reached no controls`).toBeGreaterThan(0);
  expect(missing, `${name}: focused controls without a visible indicator`).toEqual([]);
}

type OverlayKind = "timer" | "tasks" | "widget";

/**
 * Wait until an overlay or the bot widget has rendered from its first payload. Before that
 * (and for a dead token) they render nothing, while <body> already holds the layout's inline
 * style and Next's scripts, so "body has text" is not a signal.
 */
async function waitForOverlay(page: Page, kind: OverlayKind, timeout = 10_000) {
  if (kind === "timer") {
    await expect(page.getByRole("img", { name: "Timer progress ring" })).toBeVisible({ timeout });
    await expect(page.getByText(/^\d{1,2}:\d{2}(:\d{2})?$/).first()).toBeVisible({ timeout });
  } else if (kind === "tasks") {
    await expect(
      page.locator("[data-task-row]").or(page.getByText("No tasks yet")).first(),
    ).toBeVisible({ timeout });
  } else {
    await expect(page.getByRole("main", { name: "DireWork bot widget" })).toBeAttached({ timeout });
    await expect(page.getByRole("status")).toHaveText(/^DireWork bot: \S/, { timeout });
  }
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
      for (const [path, name, kind] of [
        [`/overlay/t/${t.timer}`, "timer-overlay", "timer"],
        [`/overlay/l/${t.tasks}`, "tasks-overlay", "tasks"],
        [`/bot/${t.bot}`, "bot-widget", "widget"],
      ] as const) {
        await page.goto(path);
        await page.addStyleTag({ content: "html{background:#18181b!important}" });
        await waitForOverlay(page, kind);
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

  test("the focus check rejects an invisible ring and accepts a real one", async ({ page }) => {
    // `ring-0` (a 0px shadow), a transparent ring and a focus style that only matches the
    // rest style must all count as no indicator; a 2px ring and an outline count.
    await page.setContent(`
      <style>
        button { border: 0; outline: none; box-shadow: 0 0 0 0 rgb(0 0 0); }
        #transparent:focus-visible { box-shadow: 0 0 0 2px transparent; }
        #always { box-shadow: 0 0 0 2px rgb(255 0 0); }
        #ring:focus-visible { box-shadow: 0 0 0 2px rgb(0 0 255); }
        #outline:focus-visible { outline: 2px solid rgb(0 0 255); }
      </style>
      <button id="ring0">ring-0</button>
      <button id="transparent">transparent</button>
      <button id="always">always</button>
      <button id="ring">ring</button>
      <button id="outline">outline</button>`);
    const { reached, missing } = await stopsWithoutFocusIndicator(page);
    expect(reached).toBe(5);
    expect(missing).toEqual(["button[ring-0]", "button[transparent]", "button[always]"]);
  });

  test("the overlay wait does not pass on an overlay that rendered nothing", async ({ page }) => {
    // A dead token renders nothing, like an overlay whose first payload never arrived, yet
    // <body> still has text (the layout's inline style, Next's scripts).
    await page.goto("/overlay/t/not-a-real-token");
    expect(
      await page.evaluate(() => (document.body.textContent ?? "").trim().length),
    ).toBeGreaterThan(0);
    await expect(waitForOverlay(page, "timer", 3_000)).rejects.toThrow();
    await page.goto("/overlay/l/not-a-real-token");
    await expect(waitForOverlay(page, "tasks", 3_000)).rejects.toThrow();
  });

  for (const { path, heading, name } of PAGES.slice(0, 3)) {
    test(`every Tab stop on ${path} shows a focus indicator`, async ({ page }) => {
      await openPage(page, path, heading);
      await expectVisibleFocusOnEveryStop(page, name);
    });
  }

  test("tab panel focus outlines are not clipped; red icon actions focus in red", async ({
    page,
  }) => {
    /** The focused element's outline box (rect + offset + width) fits every clipping ancestor. */
    const expectOutlineUnclipped = async (label: string) => {
      const clipped = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        const grow = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth);
        const r = el.getBoundingClientRect();
        const box = { l: r.left - grow, t: r.top - grow, r: r.right + grow, b: r.bottom + grow };
        const out: string[] = [];
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX === "visible" && s.overflowY === "visible") continue;
          const p = a.getBoundingClientRect();
          // A scroll container clips only on the axes it scrolls on; its own scroll moves
          // the outline into view, so check the non-scrolling (cross) axis only.
          const clipX =
            s.overflowX !== "visible" && (box.l < p.left - 0.5 || box.r > p.right + 0.5);
          const clipY =
            s.overflowY !== "visible" &&
            !["auto", "scroll"].includes(s.overflowY) &&
            (box.t < p.top - 0.5 || box.b > p.bottom + 0.5);
          if (clipX || clipY) out.push(`${a.tagName.toLowerCase()}.${a.className}`.slice(0, 120));
        }
        return { grow, out };
      });
      expect(clipped.grow, `${label}: tab panel has a focus outline`).toBeGreaterThan(0);
      expect(clipped.out, `${label}: outline clipped by`).toEqual([]);
    };

    await openPage(page, "/dashboard", /Wolf Streamer/);
    // OBS sources: the Tasks tab, then Tab moves keyboard focus into its panel.
    await page.getByRole("tab", { name: "Tasks" }).click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tabpanel", { name: "Tasks" })).toBeFocused();
    await expectOutlineUnclipped("OBS sources");

    // The overlay URL Reset is a red icon action: its keyboard focus border is red (its own
    // text color), not the blue ring.
    const reset = page.getByRole("button", { name: "Reset Tasks overlay URL" });
    await reset.focus();
    const colors = await reset.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopColor, text: s.color, visible: el.matches(":focus-visible") };
    });
    expect(colors.visible).toBe(true);
    expect(colors.border).toBe(colors.text);

    await openPage(page, "/dashboard/styles", "Theme Center");
    await page.getByRole("tab", { name: "Timer style" }).click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tabpanel", { name: "Timer style" })).toBeFocused();
    await expectOutlineUnclipped("Theme Center editor");
  });
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
