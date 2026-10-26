import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { API_ORIGIN } from "../src/env";
import { clearBotLease, setBotAccount, signIn } from "./helpers";

// The bot page's `?view=dock` layout for an OBS custom browser dock. The e2e owner has no
// bot account, so a valid bot token lands in the "not connected" phase — enough to tell the
// two layouts apart without Twitch. The button test stubs getSession and ingest on the api
// origin (and holds the IRC socket open) to watch exactly what one click sends. The lease
// tests stub only getSession and IRC: the one-bot-page lease (bot.heartbeat, bot.ingest's
// check, bot.release) runs on the real api and D1.

/** The current bot page token, read the way the dashboard does (owner-only query). */
async function botToken(page: Page): Promise<string> {
  const res = await page.request.get("/rpc/bot.getIngestInfo");
  expect(res.ok(), `bot.getIngestInfo answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { result: { data: { botToken: string } } };
  return body.result.data.botToken;
}

test("?view=dock renders the dock control panel; the default view is the blank widget", async ({
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

  // The default view is the blank widget: the same session, but only a screen-reader status
  // and the tab title, and no controls.
  await page.goto(`/bot/${token}`);
  await expect(page.getByRole("main", { name: "DireWork bot widget" })).toBeAttached();
  await expect(page.getByRole("status")).toHaveText("DireWork bot: Bot not connected");
  await expect(page).toHaveTitle("DireWork bot · Bot not connected");
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
  // A page from an earlier attempt may still hold the chat lease; this one must get it.
  await clearBotLease(page);

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
  // The page's lease id rides along, so the api can refuse a page that lost the chat.
  expect(input?.instanceId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(dock.getByRole("region", { name: "Recent commands" })).toContainText(
    "dock: !timer pause",
  );

  // Reset asks first; cancelling sends nothing.
  await dock.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(ingested).toHaveLength(1);
});

/** Every page of the context gets a connected bot's getSession and a held IRC socket. */
async function stubConnectedBot(context: BrowserContext) {
  await context.routeWebSocket(/irc-ws\.chat\.twitch\.tv/, () => undefined);
  await context.route(/\/trpc\/bot\.getSession\b/, (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": route.request().headers().origin ?? "*",
        "content-type": "application/json",
      },
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
}

/** Check in as a brand-new bot page would: true (and it now holds the lease) when it was free. */
async function checkInAsNewPage(page: Page, token: string): Promise<boolean> {
  const res = await page.request.post(`${API_ORIGIN}/trpc/bot.heartbeat`, {
    data: { token, instanceId: crypto.randomUUID() },
  });
  expect(res.ok(), `bot.heartbeat answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { result: { data: { holder: boolean } } };
  return body.result.data.holder;
}

test("a second bot page stands by, and Take over moves the chat to it", async ({
  page,
  context,
}, testInfo) => {
  await signIn(page);
  const token = await botToken(page);
  await clearBotLease(page);
  await stubConnectedBot(context);
  // bot.ingest and bot.heartbeat are NOT stubbed: the real api holds the lease.

  await page.goto(`/bot/${token}?view=dock`);
  const firstDock = page.getByRole("main", { name: "DireWork bot dock" });
  await expect(firstDock.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();

  const second = await context.newPage();
  await second.goto(`/bot/${token}?view=dock`);
  const secondDock = second.getByRole("main", { name: "DireWork bot dock" });
  await expect(secondDock.getByRole("status")).toHaveText("Standby");
  await expect(second).toHaveTitle("DireWork bot · Standby");
  await expect(
    secondDock.getByRole("heading", { name: "The bot is running somewhere else" }),
  ).toBeVisible();
  await expect(secondDock.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  // An OBS dock is narrow: the standby notice and its button must fit without side scroll.
  await second.setViewportSize({ width: 300, height: 600 });
  await expect(secondDock.getByRole("button", { name: "Take over" })).toBeInViewport();
  expect(await second.evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth")).toBe(
    true,
  );
  await second.screenshot({ path: testInfo.outputPath("bot-dock-standby.png") });

  // The blank widget stands by invisibly: only the tab title and screen readers say so.
  const widget = await context.newPage();
  await widget.goto(`/bot/${token}`);
  await expect(widget).toHaveTitle("DireWork bot · Standby");
  await expect(widget.getByRole("status")).toHaveText("DireWork bot: Standby");
  await expect(widget.getByRole("button", { name: "Take over" })).toHaveCount(0);
  await widget.close();

  await secondDock.getByRole("button", { name: "Take over" }).click();
  // The button leaves with the notice; focus lands on the status it changed, not on <body>.
  await expect(secondDock.getByRole("status")).toBeFocused();
  await expect(secondDock.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect(secondDock.getByRole("button", { name: "Take over" })).toHaveCount(0);

  // The first page's next relay is refused by the api, and it stands by at once.
  await firstDock.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(firstDock.getByRole("status")).toHaveText("Standby");
  await expect(firstDock.getByRole("button", { name: "Take over" })).toBeVisible();

  // Closing the page that holds the chat gives the lease up on the way out.
  expect(await checkInAsNewPage(page, token)).toBe(false);
  await second.close();
  await expect.poll(() => checkInAsNewPage(page, token)).toBe(true);
  await clearBotLease(page);
});

test("the dashboard's bot chip says whether a bot page is running", async ({ page }) => {
  await signIn(page);
  await setBotAccount(page, true);
  try {
    await clearBotLease(page);
    const token = await botToken(page);
    const chip = page.getByRole("link", { name: /open Bot settings$/ });

    await page.goto("/dashboard");
    await expect(chip).toHaveAccessibleName("Bot offline, open Bot settings");

    // A bot page checks in (the same call it makes before joining chat).
    expect(await checkInAsNewPage(page, token)).toBe(true);
    await page.reload();
    await expect(chip).toHaveAccessibleName("Bot connected, open Bot settings");
  } finally {
    await clearBotLease(page);
    await setBotAccount(page, false);
  }
});
