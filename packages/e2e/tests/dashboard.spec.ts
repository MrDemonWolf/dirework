import { expect, test } from "@playwright/test";

import { revealSecretUrl, signIn } from "./helpers";

// One owner, one task list: these build on each other, so they run in order.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
});

test("signs in through the dev bypass and greets the owner", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dev Streamer");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

test("adds a task, shows it on the tasks overlay, and marks it done", async ({ page, context }) => {
  const text = `Write the e2e suite ${Date.now()}`;
  await page.getByLabel("New task text").fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  // The overlay is a separate public page polling the api directly with its token.
  const overlayUrl = await revealSecretUrl(page, "Tasks overlay");
  const overlay = await context.newPage();
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(text)).toBeVisible();
  await overlay.close();

  await page.getByLabel(`Mark "${text}" as done`).click();
  await expect(page.getByLabel(`${text} (done)`)).toBeVisible();
});

test("removing a task offers Undo, and Undo puts it back", async ({ page }) => {
  const text = `Undo me ${Date.now()}`;
  await page.getByLabel("New task text").fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByLabel(`Remove "${text}"`).click();
  await expect(page.getByText(text)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(text)).toBeVisible();
});
