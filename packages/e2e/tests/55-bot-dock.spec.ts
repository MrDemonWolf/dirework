import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

// The bot page's `?view=dock` layout for an OBS custom browser dock. The e2e owner has no
// bot account, so a valid bot token lands in the "not connected" phase — enough to tell the
// two layouts apart without Twitch.

/** The current bot page token, read the way the dashboard does (owner-only query). */
async function botToken(page: Page): Promise<string> {
  const res = await page.request.get("/rpc/bot.getIngestInfo");
  expect(res.ok(), `bot.getIngestInfo answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { result: { data: { botToken: string } } };
  return body.result.data.botToken;
}

test("?view=dock renders the dock control panel; the default view stays the console", async ({
  page,
}) => {
  await signIn(page);
  const token = await botToken(page);

  await page.goto(`/bot/${token}?view=dock`);
  const dock = page.getByRole("main", { name: "DireWork bot dock" });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("status")).toHaveText("Bot not connected");
  await expect(dock.getByRole("region", { name: "Last error" })).toContainText("None this session");
  await expect(dock.getByRole("region", { name: "Recent commands" })).toBeVisible();
  await expect(dock.getByText("Closing it stops the bot.")).toBeVisible();
  // Not-configured already polls on its own; Reconnect is a manual restart.
  await expect(dock.getByRole("button", { name: "Reconnect" })).toBeVisible();

  await page.goto(`/bot/${token}`);
  await expect(page.getByRole("status")).toHaveText("Bot not connected");
  await expect(page.getByRole("log", { name: "Activity log" })).toBeVisible();
  await expect(page.getByRole("main", { name: "DireWork bot dock" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reconnect" })).toHaveCount(0);
});
