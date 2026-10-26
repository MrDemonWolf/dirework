import { expect, test } from "@playwright/test";

import {
  confirmDialog,
  expectNoHydrationErrors,
  revealSecretUrl,
  signIn,
  taskRow,
  watchHydration,
} from "./helpers";

// One owner, one task list: these build on each other, so they run in order.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signIn(page);
  watchHydration(page);
  await page.goto("/dashboard");
  // The streamed dashboard must hydrate, not be thrown away and client-rendered (which
  // briefly left two copies of every control in the DOM).
  await expectNoHydrationErrors(page);
});

test("signs in through the dev bypass and greets the owner", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wolf Streamer");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

test("adds a task, shows it on the tasks overlay, and marks it done", async ({ page, context }) => {
  const text = `Write the e2e suite ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(taskRow(page, text)).toBeVisible();

  // The overlay is a separate public page polling the api directly with its token. Both
  // overlay URLs live in the timer console's OBS sources, one tab each.
  await page.getByRole("tab", { name: "Tasks" }).click();
  const overlayUrl = await revealSecretUrl(page, "Tasks overlay");
  const overlay = await context.newPage();
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(text)).toBeVisible();
  await overlay.close();

  await page.getByLabel(`Mark "${text}" as done`).click();
  await expect(page.getByLabel(`${text} (done)`)).toBeVisible();
});

test("shows the owner's active task beside the timer as Now, from the polled list", async ({
  page,
}) => {
  const text = `Now line ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = taskRow(page, text);
  await expect(row).toBeVisible();
  // A new task is the focus only when the owner had none; otherwise make it the focus.
  if (!(await row.getByText("Focus", { exact: true }).count())) {
    await page.getByRole("button", { name: `Actions for "${text}"` }).click();
    await page.getByRole("menuitem", { name: "Make focus" }).click();
  }
  await expect(row.getByText("Focus", { exact: true })).toBeVisible();

  // The "Now" line carries the full text in its title (the visible text truncates).
  await expect(page.getByTitle(text, { exact: true })).toBeVisible();

  // Done → no longer active → the line goes (or shows the next task, never this one).
  await page.getByLabel(`Mark "${text}" as done`).click();
  await expect(page.getByLabel(`${text} (done)`)).toBeVisible();
  await expect(page.getByTitle(text)).toHaveCount(0);
});

test("Start parks a task as Started, Make focus swaps, Pause returns it, the cap disables Start", async ({
  page,
}) => {
  // A clean board, so the owner's focus and started counts are known (and a retry starts over).
  await page.getByRole("button", { name: "Task board options" }).click();
  const clearAll = page.getByRole("menuitem", { name: /^Clear all/ });
  if (await clearAll.isEnabled()) {
    await clearAll.click();
    await confirmDialog(page, "Clear all tasks");
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByText("What are you working on today?")).toBeVisible();

  const stamp = Date.now();
  const a = `Juggle A ${stamp}`;
  const b = `Juggle B ${stamp}`;
  const c = `Juggle C ${stamp}`;
  const d = `Juggle D ${stamp}`;
  for (const text of [a, b, c, d]) {
    await page.getByRole("textbox", { name: "New task text" }).fill(text);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(taskRow(page, text)).toBeVisible();
  }
  const chip = (text: string, label: "Focus" | "Started") =>
    taskRow(page, text).getByText(label, { exact: true });

  // The first task of an owner with no focus became the focus.
  await expect(chip(a, "Focus")).toBeVisible();

  // Start beside a focus parks the task as started.
  await page.getByRole("button", { name: `Start "${b}"` }).click();
  await expect(chip(b, "Started")).toBeVisible();
  await expect(page.getByText(`also: ${b}`)).toBeVisible();

  // Make focus swaps: B takes the focus, A is parked as started.
  await page.getByRole("button", { name: `Make "${b}" the focus` }).click();
  await expect(chip(b, "Focus")).toBeVisible();
  await expect(chip(a, "Started")).toBeVisible();

  // A focus plus two started tasks is the cap: Start is off on the rest, and says why.
  await page.getByRole("button", { name: `Start "${c}"` }).click();
  await expect(chip(c, "Started")).toBeVisible();
  const startD = page.getByRole("button", { name: `Start "${d}"` });
  await expect(startD).toBeDisabled();
  await taskRow(page, d).hover();
  await startD.hover();
  await expect(page.getByText("3 in progress — finish or pause one")).toBeVisible();
  // The row menu says the same, with Start off.
  await page.getByRole("button", { name: `Actions for "${d}"` }).click();
  await expect(page.getByRole("menuitem", { name: /^Start/ })).toBeDisabled();
  await page.keyboard.press("Escape");

  // Pause a started task: back to the queue (no chip), and Start is on again.
  await page.getByRole("button", { name: `Pause "${a}"` }).click();
  await expect(chip(a, "Started")).toHaveCount(0);
  await expect(chip(a, "Focus")).toHaveCount(0);
  await expect(startD).toBeEnabled();

  // Pause the focus: it goes back to the queue and the oldest started task takes over.
  await page.getByRole("button", { name: `Pause "${b}"` }).click();
  await expect(chip(b, "Focus")).toHaveCount(0);
  await expect(chip(c, "Focus")).toBeVisible();
});

test("the stats strip and focus chart render, and a finished task counts at once", async ({
  page,
}) => {
  const stats = page.getByRole("region", { name: "Today's stats" });
  await expect(stats.getByRole("term")).toHaveText([
    "Focus today",
    "Pomodoros today",
    "Tasks done today",
    "This week",
  ]);
  await expect(
    page.getByRole("table", { name: "Focus time per day, last 14 days" }),
  ).toBeAttached();
  await expect(
    page.getByRole("table", { name: /Focus time per day/ }).getByRole("row"),
  ).toHaveCount(15);

  // Relative to what earlier specs (or a retry) already finished today.
  const tasksDone = stats
    .getByText("Tasks done today", { exact: true })
    .locator("xpath=following-sibling::dd[1]");
  const before = Number(await tasksDone.textContent());

  const text = `Count me ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel(`Mark "${text}" as done`)).toBeVisible();

  const summaryFetches: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("stats.summary")) summaryFetches.push(request.url());
  });
  await page.getByLabel(`Mark "${text}" as done`).click();

  // No reload: the task poll saw a newer completion, so the summary refetched — once.
  await expect(tasksDone).toHaveText(String(before + 1));
  await page.waitForTimeout(1500);
  expect(summaryFetches).toHaveLength(1);
});

test("Live preview opens as the timer card's right-hand column on a wide screen", async ({
  page,
}) => {
  const toggle = page.getByRole("button", { name: "Live preview of the timer overlay" });
  const column = page.getByRole("complementary", { name: "Live preview" });
  await expect(column).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(column.getByRole("heading", { name: "Timer overlay" })).toBeVisible();
  await expect(column.locator('iframe[title="Timer overlay preview"]')).toBeVisible();
  // The column sits to the right of the controls, and its stage is the only preview.
  const columnBox = await column.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(columnBox!.x).toBeGreaterThan(toggleBox!.x + toggleBox!.width);
  await expect(page.locator("iframe")).toHaveCount(1);

  // The tab follows: Tasks swaps the overlay in the same column.
  await page.getByRole("tab", { name: "Tasks" }).click();
  await expect(column.getByRole("heading", { name: "Tasks overlay" })).toBeVisible();
  await expect(column.locator('iframe[title="Tasks overlay preview"]')).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(1);

  // Close turns the preview off (no iframe left polling) and hands focus back to the switch.
  await column.getByRole("button", { name: "Close live preview" }).click();
  await expect(column).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  const tasksToggle = page.getByRole("button", { name: "Live preview of the tasks overlay" });
  await expect(tasksToggle).toHaveAttribute("aria-pressed", "false");
  await expect(tasksToggle).toBeFocused();
});

test("on a 320px phone a long active task wraps in full across the row", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const text = `https://example.com/${"averyveryverylongunbrokenpath".repeat(3)}?t=${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = taskRow(page, text);
  await expect(row).toBeVisible();
  if (!(await row.getByText("Focus", { exact: true }).count())) {
    await page.getByRole("button", { name: `Actions for "${text}"` }).click();
    await page.getByRole("menuitem", { name: "Make focus" }).click();
  }
  await expect(row.getByText("Focus", { exact: true })).toBeVisible();

  // The status chip moves under the text, so the text keeps most of the row (it once got
  // ~75px of it), shows in full (no clamp) and widens nothing.
  const sizes = await row.evaluate((li) => {
    const p = li.querySelector("p");
    return {
      row: li.getBoundingClientRect().width,
      text: p?.getBoundingClientRect().width ?? 0,
      clipped: p ? p.scrollHeight > p.clientHeight + 1 : true,
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    };
  });
  expect(sizes.text, "task text width").toBeGreaterThan(sizes.row * 0.7);
  expect(sizes.clipped, "task text clipped").toBe(false);
  expect(sizes.scroll, "page wider than the viewport").toBeLessThanOrEqual(sizes.client);

  await page.getByLabel(`Remove "${text}"`).click();
  await expect(page.getByText(text)).toHaveCount(0);
});

test("removing a task offers Undo, and Undo puts it back", async ({ page }) => {
  const text = `Undo me ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(taskRow(page, text)).toBeVisible();

  await page.getByLabel(`Remove "${text}"`).click();
  await expect(page.getByText(text)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(taskRow(page, text)).toBeVisible();
});

test("the header toggle switches the theme and the browser bar follows", async ({ page }) => {
  // The toggle and ThemeColorSync read next-themes through the theme store
  // (components/theme-provider.tsx), not its context: this drives that bridge both ways.
  const toggle = page.getByRole("switch", { name: "Toggle dark mode" });
  const html = page.locator("html");
  const metas = page.locator('meta[name="theme-color"]');
  await expect(toggle).toBeChecked();

  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(html).toHaveClass(/\blight\b/);
  for (const meta of await metas.all()) await expect(meta).toHaveAttribute("content", "#fafafa");

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(html).toHaveClass(/\bdark\b/);
  for (const meta of await metas.all()) await expect(meta).toHaveAttribute("content", "#0c0c0e");
});
