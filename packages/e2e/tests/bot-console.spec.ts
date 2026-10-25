import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

import { BOT_REAUTH_REQUIRED_MESSAGE } from "../../api/src/config-shared";

const botPath = "/bot/synthetic-console-test-token";

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

test("bot console relays commands and stays readable in OBS, mobile and desktop sizes", async ({
  page,
}, testInfo) => {
  let twitch: WebSocketRoute | undefined;
  let revoked = false;
  const ingests: unknown[] = [];
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
      status: revoked ? 401 : 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([
        revoked
          ? { error: { message: "Unauthorized", code: -32001, data: { code: "UNAUTHORIZED" } } }
          : { result: { data: { replies: ["Task added for Viewer"] } } },
      ]),
    });
  });
  await page.routeWebSocket("wss://irc-ws.chat.twitch.tv/**", (socket) => {
    twitch = socket;
    socket.onMessage((message) => {
      if (String(message).startsWith("NICK ")) {
        socket.send(":tmi.twitch.tv 001 focusbot :Welcome\r\n");
      }
    });
  });
  await page.goto(botPath);
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible();
  await expect(page.getByText("#focusroom", { exact: true })).toBeVisible();
  expect(twitch).toBeDefined();
  twitch!.send(
    "@id=test-command;user-id=789;display-name=Viewer;mod=0 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #focusroom :!task Read a chapter\r\n",
  );
  const activity = page.getByRole("log", { name: "Activity log" });
  await expect(activity).toContainText("Viewer: !task Read a chapter");
  await expect(activity).toContainText("Task added for Viewer");
  expect(ingests).toHaveLength(1);
  await expect(page.getByText("synthetic-chat-secret")).toHaveCount(0);

  for (const [name, width, height] of [
    ["obs", 400, 200],
    ["mobile", 390, 844],
    ["desktop", 1100, 760],
  ] as const) {
    await page.setViewportSize({ width, height });
    const status = page.getByRole("status").filter({ hasText: "Connected" });
    await expect(status).toBeInViewport();
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth")).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`bot-console-${name}.png`) });
  }
  twitch!.close({ code: 1001, reason: "Synthetic network interruption" });
  await expect(page.getByRole("status").filter({ hasText: "Reconnecting" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible();
  revoked = true;
  twitch!.send(
    "@id=revoked-command;user-id=789;display-name=Viewer;mod=0 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #focusroom :!done\r\n",
  );
  await expect(page.getByRole("heading", { name: "Bot page URL reset" })).toBeVisible();
});

for (const [code, message, heading] of [
  ["BAD_REQUEST", "Invalid input", "Invalid bot page URL"],
  ["UNAUTHORIZED", "Unauthorized", "Invalid bot page URL"],
  ["PRECONDITION_FAILED", "Bot reauthentication required", "Bot login expired"],
] as const) {
  test(`bot console explains ${code} without displaying credentials`, async ({ page }) => {
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
    await page.goto(botPath);
    const notice = page
      .getByRole("alert")
      .filter({ has: page.getByRole("heading", { name: heading }) });
    await expect(notice).toBeVisible();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(notice).toContainText("Dashboard");
  });
}

test("unconfigured bot console explains the next step", async ({ page }) => {
  await mockBotSession(
    page,
    {
      error: { message: "No bot account", code: -32004, data: { code: "NOT_FOUND" } },
    },
    404,
  );
  await page.goto(botPath);
  await expect(page.getByRole("status").filter({ hasText: "Bot not connected" })).toBeVisible();
  await expect(page.getByText(/Connect a bot account in Dashboard/)).toBeVisible();
});
