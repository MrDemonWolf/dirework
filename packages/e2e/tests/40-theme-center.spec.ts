import { expect, test } from "@playwright/test";

import { DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";

import { confirmDialog, signIn, waitForHydration } from "./helpers";

test("a hard load paints the finished page, never the loading skeleton", async ({ page }) => {
  await signIn(page);
  // After every frame from the first one on, note whether a skeleton block was on screen inside
  // <main>. The check runs in a task queued from the frame's rAF, so it sees the DOM as that
  // frame painted it (React reveals streamed content in a later rAF callback of the same
  // frame). Streamed segments sit in hidden containers until revealed, so only a rendered
  // (non-zero box) skeleton counts: that is what the owner would see.
  await page.addInitScript(() => {
    const seen: number[] = [];
    (window as unknown as { __skeletonFrames: number[] }).__skeletonFrames = seen;
    const afterPaint = () => {
      const blocks = document.querySelectorAll('main [data-slot="skeleton"]');
      if ([...blocks].some((block) => block.getClientRects().length > 0)) {
        seen.push(Math.round(performance.now()));
      }
      if (performance.now() < 3000) requestAnimationFrame(() => setTimeout(afterPaint, 0));
    };
    requestAnimationFrame(() => setTimeout(afterPaint, 0));
  });
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await expect(page.getByRole("radiogroup", { name: "Theme presets" })).toBeVisible();
  await page.waitForTimeout(500);
  const frames = await page.evaluate(
    () => (window as unknown as { __skeletonFrames: number[] }).__skeletonFrames,
  );
  expect(frames, "frames that showed the loading skeleton").toEqual([]);
});

test("fits a 390px phone, with the preview one tap away above the editors", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, "Theme Center wider than a 390px viewport").toBeLessThanOrEqual(
    widths.client,
  );

  // Collapsed, the preview is a status bar; Show opens a compact canvas that stays pinned
  // under the header while the editors scroll beneath it.
  const toggle = page.getByRole("button", { name: "Show preview" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Preview timer" })).toBeHidden();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Hide preview" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const previewTimer = page.getByRole("button", { name: "Preview timer" });
  await expect(previewTimer).toBeVisible();

  await page.getByRole("button", { name: "Opacity section options" }).scrollIntoViewIfNeeded();
  await expect(previewTimer).toBeInViewport();
});

test("applies a preset, saves it, and finds it selected after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);

  const presets = page.getByRole("radiogroup", { name: "Theme presets" }).getByRole("radio");
  await expect(presets.first()).toBeVisible();

  // Pick a preset that is NOT selected right now. A CI retry runs against the same database,
  // so the preset a previous attempt saved is already checked, and clicking it would change
  // nothing: the Save bar only appears for unsaved changes.
  const checked = await presets.evaluateAll((radios) =>
    radios.map((radio) => radio.getAttribute("aria-checked")),
  );
  const target = checked.lastIndexOf("false");
  expect(target, "expected at least one unselected preset").toBeGreaterThan(-1);

  await presets.nth(target).click();
  await expect(presets.nth(target)).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();

  await page.reload();
  await expect(presets.nth(target)).toHaveAttribute("aria-checked", "true");
});

test("previews either overlay over a chosen backdrop and says when edits are unsaved", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);

  // Freshly loaded, the preview shows exactly what OBS shows.
  await expect(page.getByText("Matches the saved theme")).toBeVisible();

  const previewTimer = page.getByRole("button", { name: "Preview timer" });
  const previewTasks = page.getByRole("button", { name: "Preview tasks" });
  await expect(previewTimer).toHaveAttribute("aria-pressed", "true");
  // The stream scene: the selected source's size on the 1080p canvas, both overlays on it.
  await expect(page.getByText("300 × 300 in 1080p")).toBeVisible();
  await expect(page.getByText("Sketch three logo concepts").first()).toBeAttached();
  await previewTasks.click();
  await expect(previewTasks).toHaveAttribute("aria-pressed", "true");
  await expect(previewTimer).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("700 × 800 in 1080p")).toBeVisible();

  // Close-up zooms to the selected source alone; Play only shows while the timer is on view.
  const closeUp = page.getByRole("button", { name: "Close-up" });
  await closeUp.click();
  await expect(closeUp).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("700 × 800", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeHidden();
  // The sample rows come from the shared demo session. A list taller than the source
  // scrolls, which renders the rows twice, hence first().
  await expect(page.getByText("Sketch three logo concepts").first()).toBeVisible();
  await closeUp.click();
  await expect(closeUp).toHaveAttribute("aria-pressed", "false");

  const bright = page.getByRole("button", { name: "Bright backdrop" });
  await bright.click();
  await expect(bright).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Dark backdrop" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // An edit is previewed before it is saved. The label is unique per run, so a retry
  // against the same database still changes something.
  await previewTimer.click();
  await page.getByRole("tab", { name: "Phase labels" }).click();
  await page.getByLabel("Finished", { exact: true }).fill(`All done ${Date.now() % 100_000}`);
  await expect(page.getByText("Previewing unsaved changes")).toBeVisible();
  // The save bar names it too (its live region repeats the words for screen readers).
  await expect(page.getByText("Unsaved — not on stream yet").first()).toBeVisible();
  // Only the edited tab carries the unsaved dot.
  await expect(page.getByRole("tab", { name: "Phase labels (unsaved changes)" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Timer style", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();
  await expect(page.getByText("Matches the saved theme")).toBeVisible();
});

test("keeps each label beside its control and nudges lengths with the arrow keys", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Typography", exact: true }).click();

  // The control column sits right after the label, not at the far edge of a wide editor.
  const time = page.getByRole("textbox", { name: "Time", exact: true });
  const gap = await time.evaluate((input: HTMLInputElement) => {
    const label = input.labels?.[0];
    if (!label) return Number.POSITIVE_INFINITY;
    return input.getBoundingClientRect().left - label.getBoundingClientRect().left;
  });
  expect(gap, "px from the label's start to its control").toBeLessThan(320);
  // Every control shares one width: a color field (swatch + hex) matches a length field.
  const colorField = page.getByRole("textbox", { name: "Track", exact: true }).locator("..");
  const [colorBox, timeBox] = await Promise.all([colorField.boundingBox(), time.boundingBox()]);
  expect(Math.round(colorBox?.width ?? 0)).toBe(Math.round(timeBox?.width ?? -1));

  // ArrowUp adds 1 and Shift+ArrowUp 10, keeping the unit; the value lives in one field.
  const start = Number.parseFloat(await time.inputValue());
  await time.press("ArrowUp");
  await expect(time).toHaveValue(`${start + 1}px`);
  await time.press("Shift+ArrowUp");
  await expect(time).toHaveValue(`${start + 11}px`);
  await expect(page.getByText("Previewing unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await confirmDialog(page, "Discard changes");
  await expect(time).toHaveValue(`${start}px`);
});

test("resets one section of the draft to the Default theme", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);

  // Save a non-default track color first, so resetting Colors has something to change.
  // A retry finds the previous attempt's color saved, so it picks the other one.
  const track = page.getByRole("textbox", { name: "Track", exact: true });
  const custom = (await track.inputValue()) === "#a1b2c3" ? "#c3b2a1" : "#a1b2c3";
  await track.fill(custom);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();
  await expect(page.getByText("Matches the saved theme")).toBeVisible();

  // The editors are seeded from the server-prefetched config, so the saved color is in the
  // server HTML itself — not painted over a frame of defaults after hydration (which is
  // where a fill used to land, appended to the value the swap wrote).
  const html = await (await page.request.get("/dashboard/styles")).text();
  expect(html).toContain(`value="${custom}"`);

  await page.getByRole("button", { name: "Colors section options" }).click();
  await page.getByRole("menuitem", { name: "Reset section" }).click();
  await confirmDialog(page, "Reset section");

  // The reset only changes the draft: the color is back to the default, not yet saved.
  await expect(track).toHaveValue(DEFAULT_TIMER_STYLES.ring.trackColor);
  await expect(page.getByText("Previewing unsaved changes")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Timer style (unsaved changes)" })).toBeVisible();

  // Discard it, so the saved theme is what later specs see.
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await confirmDialog(page, "Discard changes");
  await expect(page.getByText("Matches the saved theme")).toBeVisible();
  await expect(track).toHaveValue(custom);
});
