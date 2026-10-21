import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

// The bot page's `?view=dock` layout for an OBS custom browser dock. The e2e owner has no
// bot account, so a valid bot token lands in the "not connected" phase — enough to tell the
// two layouts apart without Twitch. The button test stubs getSession and ingest on the api
// origin (and holds the IRC socket open) to watch exactly what one click sends.

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
  // The command buttons render, but stay off until a bot account is connected.
  for (const name of ["Start", "Pause", "Resume", "Skip", "Reset", "Mute bot", "Clear done"]) {
    await expect(dock.getByRole("button", { name, exact: true })).toBeDisabled();
  }

  await page.goto(`/bot/${token}`);
  await expect(page.getByRole("status")).toHaveText("Bot not connected");
  await expect(page.getByRole("log", { name: "Activity log" })).toBeVisible();
  await expect(page.getByRole("main", { name: "DireWork bot dock" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reconnect" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
});

/** A tRPC batch response body for one procedure result. */
function trpcBatch(data: unknown): string {
  return JSON.stringify([{ result: { data } }]);
}

test("a dock button sends its chat line to bot.ingest as the broadcaster and shows the reply", async ({
  page,
}) => {
  await signIn(page);
  const token = await botToken(page);

  // No Twitch locally: answer getSession as a connected bot would (the owner's id included),
  // hold the IRC socket open with nothing behind it, and capture what ingest is sent.
  await page.routeWebSocket(/irc-ws\.chat\.twitch\.tv/, () => undefined);
  const cors = (origin: string | undefined) => ({
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-credentials": "true",
    "content-type": "application/json",
  });
  await page.route(/\/trpc\/bot\.getSession\b/, (route) =>
    route.fulfill({
      headers: cors(route.request().headers().origin),
      body: trpcBatch({
        channelName: "devstreamer",
        botUsername: "direbot",
        chatToken: "e2e-not-a-real-token",
        aliases: [],
        muted: false,
        broadcasterId: "1000",
      }),
    }),
  );
  const ingested: unknown[] = [];
  await page.route(/\/trpc\/bot\.ingest\b/, (route) => {
    ingested.push(route.request().postDataJSON());
    return route.fulfill({
      headers: cors(route.request().headers().origin),
      body: trpcBatch({ replies: ["Done."], muted: false }),
    });
  });

  await page.goto(`/bot/${token}?view=dock`);
  const dock = page.getByRole("main", { name: "DireWork bot dock" });
  const pause = dock.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).toBeEnabled();
  await expect(dock.getByRole("button", { name: "Mute bot" })).toBeEnabled();

  await pause.click();

  await expect(dock.getByRole("region", { name: "Command result" })).toContainText("Done.");
  expect(ingested).toHaveLength(1);
  const input = (ingested[0] as Record<string, Record<string, unknown>>)["0"];
  expect(input).toMatchObject({
    token,
    kind: "message",
    username: "devstreamer",
    twitchId: "1000",
    message: "!timer pause",
    isMod: false,
  });
  expect(input?.messageId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(dock.getByRole("region", { name: "Recent commands" })).toContainText(
    "dock: !timer pause",
  );

  // Reset asks first; cancelling sends nothing.
  await dock.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(ingested).toHaveLength(1);
});
