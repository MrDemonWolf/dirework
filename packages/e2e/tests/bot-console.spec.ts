import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

import { BOT_REAUTH_REQUIRED_MESSAGE } from "../../api/src/config-shared";

// The bot page against a stubbed getSession / ingest and a held IRC socket. The default view
// is the blank widget (it sits on a stream: nothing visible, state in the tab title and to
// screen readers); `?view=dock` is the visible control panel that also serves a pinned tab.

const botPath = "/bot/synthetic-console-test-token";
const dockPath = `${botPath}?view=dock`;

async function mockBotSession(page: Page, body: unknown, status = 200) {
  await page.route("**/trpc/bot.getSession*", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([body]),
    }),
  );
}

/** Stub a connected bot: getSession, ingest (or a 401 once `revoked()`), and Twitch IRC. */
async function connectedBot(page: Page, revoked: () => boolean) {
  const ingests: unknown[] = [];
  const socket: { twitch?: WebSocketRoute } = {};
  await mockBotSession(page, {
    result: {
      data: {
        channelName: "focusroom",
        botUsername: "focusbot",
        chatToken: "synthetic-chat-secret",
      },
    },
  });
  await page.route("**/trpc/bot.ingest*", async (route) => {
    ingests.push(route.request().postDataJSON());
    await route.fulfill({
      status: revoked() ? 401 : 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([
        revoked()
          ? { error: { message: "Unauthorized", code: -32001, data: { code: "UNAUTHORIZED" } } }
          : { result: { data: { replies: ["Task added for Viewer"] } } },
      ]),
    });
  });
  await page.routeWebSocket("wss://irc-ws.chat.twitch.tv/**", (ws) => {
    socket.twitch = ws;
    ws.onMessage((message) => {
      if (String(message).startsWith("NICK ")) ws.send(":tmi.twitch.tv 001 focusbot :Welcome\r\n");
    });
  });
  return { ingests, socket };
}

const privmsg = (id: string, text: string) =>
  `@id=${id};user-id=789;display-name=Viewer;mod=0 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #focusroom :${text}\r\n`;

/** Every element that paints a box: the blank widget must have none but sr-only text. */
async function paintedBoxes(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.body.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NEXT-ROUTE-ANNOUNCER"].includes(el.tagName))
          return false;
        const rect = el.getBoundingClientRect();
        // sr-only clips to 1×1; anything larger is visible on stream.
        return rect.width > 1 && rect.height > 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
  );
}

test("the widget runs the bot with nothing visible and its state in the tab title", async ({
  page,
}, testInfo) => {
  let revoked = false;
  const { ingests, socket } = await connectedBot(page, () => revoked);
  await page.goto(botPath);
  await expect(page).toHaveTitle("DireWork bot · Connected");
  await expect(page.getByRole("status")).toHaveText("DireWork bot: Connected");

  socket.twitch!.send(privmsg("test-command", "!task Read a chapter"));
  await expect.poll(() => ingests.length).toBe(1);
  await expect(page.getByText("synthetic-chat-secret")).toHaveCount(0);

  // Transparent page, no painted element, at OBS, phone and desktop sizes.
  for (const [name, width, height] of [
    ["obs", 400, 200],
    ["mobile", 390, 844],
    ["desktop", 1100, 760],
  ] as const) {
    await page.setViewportSize({ width, height });
    const backgrounds = await page.evaluate(() => [
      getComputedStyle(document.documentElement).backgroundColor,
      getComputedStyle(document.body).backgroundColor,
    ]);
    expect(backgrounds).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
    expect(await paintedBoxes(page), `${name}: painted elements`).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`bot-widget-${name}.png`),
      omitBackground: true,
    });
  }

  // Even a fatal state stays off the stream: an alert for screen readers and the title.
  revoked = true;
  socket.twitch!.send(privmsg("revoked-command", "!done"));
  await expect(page).toHaveTitle("DireWork bot · Action needed");
  await expect(page.getByRole("alert").filter({ hasText: "Bot page URL reset" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Bot page URL reset" })).toHaveCount(0);
  expect(await paintedBoxes(page)).toEqual([]);
});

test("the dock relays commands and stays readable in an OBS dock, a phone and a desktop tab", async ({
  page,
}, testInfo) => {
  let revoked = false;
  const { ingests, socket } = await connectedBot(page, () => revoked);
  await page.goto(dockPath);
  const dock = page.getByRole("main", { name: "DireWork bot dock" });
  await expect(dock.getByRole("status")).toHaveText("Connected");
  await expect(page).toHaveTitle("DireWork bot · Connected");
  await expect(dock.getByText("#focusroom", { exact: true })).toBeVisible();

  socket.twitch!.send(privmsg("test-command", "!task Read a chapter"));
  const recent = dock.getByRole("region", { name: "Recent commands" });
  await expect(recent).toContainText("!task Read a chapter");
  await expect(recent).toContainText("Task added for Viewer");
  expect(ingests).toHaveLength(1);

  for (const [name, width, height] of [
    ["obs-dock", 300, 600],
    ["mobile", 390, 844],
    ["desktop", 1100, 760],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(dock.getByRole("status")).toBeInViewport();
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth")).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`bot-dock-${name}.png`) });
  }
  socket.twitch!.close({ code: 1001, reason: "Synthetic network interruption" });
  await expect(dock.getByRole("status")).toHaveText("Reconnecting");
  await expect(dock.getByRole("status")).toHaveText("Connected");
  revoked = true;
  socket.twitch!.send(privmsg("revoked-command", "!done"));
  await expect(page.getByRole("heading", { name: "Bot page URL reset" })).toBeVisible();
});

for (const [code, message, heading] of [
  ["BAD_REQUEST", "Invalid input", "Invalid bot page URL"],
  ["UNAUTHORIZED", "Unauthorized", "Invalid bot page URL"],
  ["PRECONDITION_FAILED", "Bot reauthentication required", "Bot login expired"],
] as const) {
  test(`the bot page explains ${code} without displaying credentials`, async ({ page }) => {
    // PRECONDITION_FAILED is fatal only for the shared reauthentication message.
    await mockBotSession(
      page,
      {
        error: {
          message: code === "PRECONDITION_FAILED" ? BOT_REAUTH_REQUIRED_MESSAGE : message,
          code: code === "BAD_REQUEST" ? -32600 : -32000,
          data: { code },
        },
      },
      code === "BAD_REQUEST" ? 400 : code === "UNAUTHORIZED" ? 401 : 412,
    );
    // The dock shows the notice…
    await page.goto(dockPath);
    const notice = page
      .getByRole("alert")
      .filter({ has: page.getByRole("heading", { name: heading }) });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Dashboard");

    // …the widget only says it, to screen readers and in the title.
    await page.goto(botPath);
    await expect(page.getByRole("alert").filter({ hasText: heading })).toBeAttached();
    await expect(page).toHaveTitle("DireWork bot · Action needed");
    await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
  });
}

test("an unconfigured bot explains the next step in the dock", async ({ page }) => {
  await mockBotSession(
    page,
    {
      error: { message: "No bot account", code: -32004, data: { code: "NOT_FOUND" } },
    },
    404,
  );
  await page.goto(dockPath);
  const dock = page.getByRole("main", { name: "DireWork bot dock" });
  await expect(dock.getByRole("status")).toHaveText("Bot not connected");
  await expect(dock.getByText(/Connect a bot account in Dashboard → Bot/)).toBeVisible();
  await page.goto(botPath);
  await expect(page).toHaveTitle("DireWork bot · Bot not connected");
});
