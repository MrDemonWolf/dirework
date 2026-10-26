import { expect, type Page, test } from "@playwright/test";

import { confirmDialog, revealSecretUrl, signIn, taskRow, waitForHydration } from "./helpers";

test.describe.configure({ mode: "serial" });

async function openTaskStyle(page: Page) {
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await page.getByRole("tab", { name: "Task style" }).click();
}

/** Opens a style section (a click on an open one would close it). */
async function openSection(page: Page, name: string) {
  const toggle = page.getByRole("button", { name, exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

/** Sets the Checkboxes switch in the draft. */
async function setCheckboxes(page: Page, on: boolean) {
  await openSection(page, "Layout");
  const checkboxes = page.getByRole("switch", { name: "Checkboxes" });
  if ((await checkboxes.getAttribute("aria-checked")) !== String(on)) await checkboxes.click();
}

test("the bullet icon picker changes the bullet the task overlay draws", async ({
  page,
  context,
}) => {
  await signIn(page);

  // A task to draw a bullet for.
  await page.goto("/dashboard");
  const text = `Bullet check ${Date.now()}`;
  await page.getByRole("textbox", { name: "New task text" }).fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(taskRow(page, text)).toBeVisible();
  await page.getByRole("tab", { name: "Tasks" }).click();
  const overlayUrl = await revealSecretUrl(page, "Tasks overlay");

  await openTaskStyle(page);
  await setCheckboxes(page, false);
  await openSection(page, "Typography");
  const icons = page.getByRole("radiogroup", { name: "Icon", exact: true });
  // A retry finds the previous attempt's pick saved, so it picks the other one.
  const pawChecked = await icons
    .getByRole("radio", { name: "Paw print" })
    .getAttribute("aria-checked");
  const pick = pawChecked === "true" ? "Star" : "Paw print";
  const pickId = pick === "Star" ? "star" : "paw-print";

  // Arrow keys move focus only; Enter picks.
  await icons.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("End");
  await expect(icons.getByRole("radio", { name: "None" })).toBeFocused();
  await icons.getByRole("radio", { name: pick }).click();
  await expect(icons.getByRole("radio", { name: pick })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();

  const overlay = await context.newPage();
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(text)).toBeVisible();
  await expect(overlay.locator(`[data-overlay-bullet="${pickId}"]`).first()).toBeVisible();
  await expect(overlay.locator(`[data-overlay-bullet="${pickId}"] svg`).first()).toBeVisible();
  await overlay.close();

  // Checkboxes back on, so later specs see the usual list.
  await setCheckboxes(page, true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved").first()).toBeVisible();
});

test("an out-of-range length shows its range at the field and blocks Save", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await openSection(page, "Typography");

  const time = page.getByRole("textbox", { name: "Time", exact: true });
  await time.fill("500px");
  await expect(time).toHaveAttribute("aria-invalid", "true");
  // The field names its range (its error is the input's description), and the Save bar says why.
  await expect(time).toHaveAccessibleDescription("Out of range. Use 32–160px or 2–40vw/vh");
  await expect(page.getByText("Out of range. Use 32–160px or 2–40vw/vh")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  // Arrow keys step back inside the range rather than further out.
  await time.press("ArrowDown");
  await expect(time).toHaveValue("160px");
  await expect(time).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

  // A phase label over 16 characters is counted and blocks Save too.
  await page.getByRole("tab", { name: "Phase labels" }).click();
  const finished = page.getByLabel("Finished", { exact: true });
  await finished.fill("A very long finished label");
  await expect(page.getByText("26/16 characters — too long to save")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await confirmDialog(page, "Discard changes");
  await expect(page.getByText("Matches the saved theme")).toBeVisible();
});
