import path from "node:path";
import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { BETTER_AUTH_SECRET, DEV_LOGIN_SECRET, PROXY_SECRET } from "../src/env";
import { signIn, waitForHydration } from "../tests/helpers";

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
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await page.getByLabel('Mark "Review the Moonlight theme" as done').click();
  await expect(page.getByLabel("Review the Moonlight theme (done)")).toBeVisible();
  await capture(page, "dashboard");
  await page.goto("/dashboard/styles");
  await waitForHydration(page);
  await expect(page.getByRole("radiogroup", { name: "Theme presets" })).toBeVisible();
  await capture(page, "theme-center");

  let socket: WebSocketRoute | undefined;
  const fulfill = (data: unknown) => ({
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify([{ result: { data } }]),
  });
  await page.route("**/trpc/bot.getSession*", (route) =>
    route.fulfill(fulfill({ channelName: "wolfstreamer", botUsername: "WolfBot", chatToken })),
  );
  await page.route("**/trpc/bot.ingest*", (route) =>
    route.fulfill(fulfill({ replies: ["MoonWolf, your task is on the list."] })),
  );
  await page.routeWebSocket("wss://irc-ws.chat.twitch.tv/**", (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      if (String(message).startsWith("NICK ")) {
        ws.send(":tmi.twitch.tv 001 wolfbot :Welcome\r\n");
      }
    });
  });
  await page.goto("/bot/synthetic-wolf-demo");
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible();
  expect(socket).toBeDefined();
  socket?.send(
    "@id=wolf-demo;user-id=789;display-name=MoonWolf;mod=0 :moonwolf!moonwolf@moonwolf.tmi.twitch.tv PRIVMSG #wolfstreamer :!task Finish the pack newsletter\r\n",
  );
  await expect(page.getByRole("log", { name: "Activity log" })).toContainText(
    "MoonWolf, your task is on the list.",
  );
  await capture(page, "bot-console");
});
