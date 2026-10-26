import { expect, test } from "@playwright/test";

import {
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dev Streamer");
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
  // A new task is active only when the owner had none; otherwise make it the active one.
  const activate = page.getByLabel(`Set "${text}" as active`);
  if (await activate.count()) await activate.click();

  // The "Now" line carries the full text in its title (the visible text truncates).
  await expect(page.getByTitle(text)).toBeVisible();

  // Done → no longer active → the line goes (or shows the next task, never this one).
  await page.getByLabel(`Mark "${text}" as done`).click();
  await expect(page.getByLabel(`${text} (done)`)).toBeVisible();
  await expect(page.getByTitle(text)).toHaveCount(0);
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
