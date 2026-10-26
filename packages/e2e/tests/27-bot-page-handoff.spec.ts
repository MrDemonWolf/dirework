import { expect, type Page, test } from "@playwright/test";

import {
  confirmDialog,
  expectNoSeriousViolations,
  revealSecretUrl,
  setBotAccount,
  signIn,
} from "./helpers";

// "How will you run the bot?" — the bot page handoff in the setup checklist's bot step and
// the Bot settings "Run the bot" card. Both exist only once a bot account is connected, so
// each test seeds a fake one (nothing here talks to Twitch) and removes it afterwards. One
// URL row at a time, named for the chosen view; the pick is remembered per browser.

test.describe.configure({ mode: "serial" });
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await setBotAccount(page, true);
});

test.afterEach(async ({ page }) => {
  // Back to the default pick and no bot account, for the next spec and a retry.
  await page.evaluate(() => localStorage.removeItem("dirework.bot-view")).catch(() => {});
  await setBotAccount(page, false);
});

function choice(page: Page) {
  return page.getByRole("radiogroup", { name: "How will you run the bot?" });
}

async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, `${where} wider than the viewport`).toBeLessThanOrEqual(widths.client);
}

test("the checklist's bot step shows one named URL for the chosen view", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "Set up streaming" });
  const step = card.getByRole("button", { name: /Add the bot to OBS or Moblin/ });
  if ((await step.getAttribute("aria-expanded")) !== "true") await step.click();

  const group = choice(page);
  const widget = group.getByRole("radio", { name: "Widget" });
  const dock = group.getByRole("radio", { name: "Dock / browser tab" });
  await expect(widget).toBeChecked();
  await expect(widget).toHaveAccessibleDescription(/invisible on stream/);
  await expect(dock).not.toBeChecked();

  // One URL row, labelled on screen, never two look-alikes.
  await expect(card.getByText("Widget URL", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /^Show .* URL$/ })).toHaveCount(1);
  expect(await revealSecretUrl(page, "Widget")).toMatch(/\/bot\/[^/?]+$/);
  await expect(card.getByRole("button", { name: /^Reset / })).toHaveCount(0);
  await expectNoSeriousViolations(page, "setup-bot-step");

  // Arrow keys move the pick; the row swaps to the dock URL, masked again.
  await widget.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dock).toBeChecked();
  await expect(dock).toBeFocused();
  await expect(card.getByText("Dock URL", { exact: true })).toBeVisible();
  await expect(card.getByText("Widget URL", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Dock URL" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await revealSecretUrl(page, "Dock")).toMatch(/\/bot\/[^/?]+\?view=dock$/);
  await expect(card).toContainText("Custom Browser Docks");
  await page.screenshot({ path: test.info().outputPath("setup-bot-step-dock.png") });

  // Remembered in this browser.
  await page.reload();
  if ((await step.getAttribute("aria-expanded")) !== "true") await step.click();
  await expect(choice(page).getByRole("radio", { name: "Dock / browser tab" })).toBeChecked();
});

test("the Run the bot card opens and resets the chosen view's URL", async ({ page }) => {
  await page.goto("/dashboard/bot");
  const group = choice(page);
  await expect(group.getByRole("radio", { name: "Widget" })).toBeChecked();
  const open = page.getByRole("button", { name: "Open widget" });
  await expect(open).toHaveAttribute("href", /\/bot\/[^/?]+$/);
  await expect(
    page.getByText("It opens blank: the tab title shows the bot's state."),
  ).toBeVisible();
  await expect(
    page.getByText("Reset gives the widget and the dock a new URL together."),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("run-the-bot-widget.png") });

  await group.getByRole("radio", { name: "Dock / browser tab" }).click();
  await expect(page.getByRole("button", { name: "Open dock" })).toHaveAttribute(
    "href",
    /\/bot\/[^/?]+\?view=dock$/,
  );
  await expect(page.getByText("Dock URL", { exact: true })).toBeVisible();
  // The whole connected Overview (Bot account's Disconnect included), which 80-a11y can't
  // reach without a bot account.
  await expectNoSeriousViolations(page, "run-the-bot");

  // One token: the confirm says both URLs change. Cancelling keeps them.
  await page.getByRole("button", { name: "Reset Dock URL" }).click();
  await expect(
    page.getByRole("alertdialog").getByRole("heading", { name: "Reset both bot page URLs?" }),
  ).toBeVisible();
  await confirmDialog(page, "Cancel");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });

  test("the two options sit side by side inside the card", async ({ page }) => {
    await page.goto("/dashboard/bot");
    const group = choice(page);
    await group.scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page, "Run the bot at 360px");
    const [groupBox, widgetBox, dockBox] = await Promise.all([
      group.boundingBox(),
      group.getByRole("radio", { name: "Widget" }).boundingBox(),
      group.getByRole("radio", { name: "Dock / browser tab" }).boundingBox(),
    ]);
    expect(groupBox && widgetBox && dockBox).toBeTruthy();
    // Same row, both inside the track.
    expect(Math.abs((widgetBox?.y ?? 0) - (dockBox?.y ?? 0))).toBeLessThan(1);
    expect((dockBox?.x ?? 0) + (dockBox?.width ?? 0)).toBeLessThanOrEqual(
      (groupBox?.x ?? 0) + (groupBox?.width ?? 0) + 0.5,
    );
    await page.screenshot({ path: test.info().outputPath("run-the-bot-phone.png") });
  });
});
