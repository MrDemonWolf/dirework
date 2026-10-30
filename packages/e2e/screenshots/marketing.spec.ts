import path from "node:path";
import { expect, type Page, type Route, test, type WebSocketRoute } from "@playwright/test";
import { BETTER_AUTH_SECRET, DEV_LOGIN_SECRET, PROXY_SECRET } from "../src/env";
import { clearBotLease, signIn, waitForHydration } from "../tests/helpers";

const images = path.resolve(import.meta.dirname, "../../../apps/fumadocs/public/screenshots");
const chatToken = "synthetic-wolf-chat-token";

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  // biome-ignore lint/performance/useDomNodeTextContent: audit rendered screenshot text, excluding hidden DOM
  const visibleContent = await page.locator("body").innerText();
  for (const secret of [chatToken, BETTER_AUTH_SECRET, DEV_LOGIN_SECRET, PROXY_SECRET]) {
    expect(visibleContent.includes(secret), "A credential must never appear in screenshots").toBe(
      false,
    );
  }
  // SecretUrlRow must stay masked: even synthetic bearer URLs must not become marketing copy.
  expect(visibleContent).not.toMatch(/\/(?:overlay\/[tl]|bot)\/[A-Za-z0-9_-]{20,}/);
  for (const input of await page.locator("input:visible").all()) {
    expect(await input.inputValue()).not.toMatch(/\/(?:overlay\/[tl]|bot)\/[A-Za-z0-9_-]{20,}/);
  }
  await page.screenshot({ path: path.join(images, `${name}.png`) });
}

test("capture synthetic Wolf example screens without a real Twitch connection", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wolf Streamer");
  const later = page.getByRole("button", { name: "Finish later" });
  if (await later.isVisible()) await later.click();
  for (const text of [
    "Write the wolf den welcome page",
    "Review the Moonlight theme",
    "Plan tomorrow’s pack session",
  ]) {
    await page.getByRole("textbox", { name: "New task text" }).fill(text);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByLabel(`Mark "${text}" as done`)).toBeVisible();
  }
  await page.getByLabel('Mark "Review the Moonlight theme" as done').click();
  await expect(page.getByLabel("Review the Moonlight theme (done)")).toBeVisible();
  await capture(page, "dashboard");
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await expect(page.getByRole("radiogroup", { name: "Theme presets" })).toBeVisible();
  await capture(page, "theme-center");

  // The bot dock (`?view=dock`), with Twitch simulated: getSession and ingest are stubbed and
  // the IRC socket is held here. The real bot token keeps the one-bot-page lease on the api.
  const ingestInfo = await page.request.get("/rpc/bot.getIngestInfo");
  expect(ingestInfo.ok()).toBe(true);
  const { botToken } = ((await ingestInfo.json()) as { result: { data: { botToken: string } } })
    .result.data;
  await clearBotLease(page);
  let socket: WebSocketRoute | undefined;
  const fulfill = (route: Route, data: unknown) =>
    route.fulfill({
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": route.request().headers().origin ?? "*",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify([{ result: { data } }]),
    });
  await page.route(/\/trpc\/bot\.getSession\b/, (route) =>
    fulfill(route, {
      channelName: "wolfstreamer",
      botUsername: "WolfBot",
      chatToken,
      aliases: [],
      muted: false,
      broadcasterId: "1000",
    }),
  );
  await page.route(/\/trpc\/bot\.ingest\b/, (route) =>
    fulfill(route, { replies: ["MoonWolf, your task is on the list."], muted: false }),
  );
  await page.routeWebSocket(/irc-ws\.chat\.twitch\.tv/, (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      if (String(message).startsWith("NICK ")) {
        ws.send(":tmi.twitch.tv 001 wolfbot :Welcome\r\n");
      }
    });
  });
  // An OBS custom browser dock is narrow.
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`/bot/${botToken}?view=dock`);
  const dock = page.getByRole("main", { name: "DireWork bot dock" });
  await expect(dock.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  expect(socket).toBeDefined();
  socket?.send(
    "@id=wolf-demo;room-id=1000;user-id=789;display-name=MoonWolf;mod=0 :moonwolf!moonwolf@moonwolf.tmi.twitch.tv PRIVMSG #wolfstreamer :!task Finish the pack newsletter\r\n",
  );
  await expect(dock.getByRole("region", { name: "Recent commands" })).toContainText(
    "Finish the pack newsletter",
  );
  await capture(page, "bot-dock");
});
