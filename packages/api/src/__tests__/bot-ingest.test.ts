import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import type { Context } from "../context";
import { BOT_REAUTH_REQUIRED_MESSAGE } from "../config-shared";
import { appRouter } from "../routers/index";
import { createSqliteDb } from "./helpers/sqlite-db";

/**
 * bot.ingest / bot.getSession driven through the REAL appRouter against a real
 * SQLite engine, so the chat-command authorization gates, config toggles,
 * aliases, and their DB effects are all exercised end to end.
 */

const BOT_TOKEN = "bot-token-0123456789abcdef";
const OWNER_TWITCH_ID = "1000";

let db: DbClient;

beforeEach(async () => {
  ({ db } = await createSqliteDb());
  await provisionSingletonRows(db);
  await db.update(schema.instanceConfig).set({ botToken: BOT_TOKEN, channelLogin: "streamer" });
  await db.insert(schema.user).values({
    id: "owner",
    name: "streamer",
    email: "owner@example.test",
    twitchId: OWNER_TWITCH_ID,
    displayName: "Streamer",
    isOwner: true,
  });
});

const api = () => appRouter.createCaller({ session: null, db } as unknown as Context);

interface Chatter {
  username?: string;
  twitchId?: string;
  isMod?: boolean;
  messageId?: string;
}

function say(message: string, chatter: Chatter = {}) {
  return api().bot.ingest({
    token: BOT_TOKEN,
    kind: "message",
    username: chatter.username ?? "viewer",
    displayName: "Viewer",
    twitchId: chatter.twitchId ?? "2000",
    message,
    isMod: chatter.isMod ?? false,
    messageId: chatter.messageId,
  });
}

async function config() {
  const row = await db.query.botConfig.findFirst();
  if (!row) throw new Error("botConfig not provisioned");
  return row;
}

async function tasks() {
  return db.query.task.findMany({ columns: { text: true, status: true, authorTwitchId: true } });
}

async function seedTasks() {
  await say("!task viewer one");
  await say("!task other one", { username: "other", twitchId: "3000" });
  await say("!done", { username: "other", twitchId: "3000" });
}

describe("bot.ingest moderator gates", () => {
  it("a non-mod !clear all is refused and deletes nothing", async () => {
    await seedTasks();
    const { replies } = await say("!clear all");

    expect(replies).toEqual([(await config()).msgNotMod.replace("{user}", "Viewer")]);
    expect(await tasks()).toHaveLength(2);
  });

  it("a mod can !clear all, !clear done, and !clear @user", async () => {
    await seedTasks();
    await say("!clear done", { isMod: true });
    expect((await tasks()).map((t) => t.text)).toEqual(["viewer one"]);

    await say("!task another", { username: "other", twitchId: "3000" });
    await say("!clear @VIEWER", { isMod: true });
    expect((await tasks()).map((t) => t.text)).toEqual(["another"]);

    await say("!clear all", { isMod: true });
    expect(await tasks()).toHaveLength(0);
  });

  it("a non-mod !timer start is refused and leaves the timer untouched", async () => {
    const { replies } = await say("!timer start");

    expect(replies).toEqual([(await config()).msgNotMod.replace("{user}", "Viewer")]);
    expect(await db.query.timerState.findFirst()).toBeUndefined();
  });

  it("the owner gets broadcaster privileges without the client claiming mod", async () => {
    await say("!timer start", { username: "streamer", twitchId: OWNER_TWITCH_ID });

    expect((await db.query.timerState.findFirst())?.status).toBe("starting");
  });

  it("a forged owner username without the owner's twitchId is not privileged", async () => {
    await say("!timer start", { username: "streamer", twitchId: "2000" });

    expect(await db.query.timerState.findFirst()).toBeUndefined();
  });
});

describe("bot.ingest task text", () => {
  it("caps !task and !next text without splitting an emoji", async () => {
    const long = `a${"🐺".repeat(296)}`; // 593 code units; .slice(0, 500) would split a pair
    await say(`!task ${long}`);
    const [added] = await tasks();
    expect(added?.text).toBe(`a${"🐺".repeat(249)}`);
    expect(added?.text.isWellFormed()).toBe(true);

    await say(`!next ${long}`);
    const texts = (await tasks()).map((t) => t.text);
    expect(texts).toHaveLength(2);
    for (const text of texts) expect(text).toBe(`a${"🐺".repeat(249)}`);
  });
});

describe("bot.ingest config", () => {
  it("ignores task commands when taskCommandsEnabled is off", async () => {
    await db.update(schema.botConfig).set({ taskCommandsEnabled: false });

    const { replies } = await say("!task hidden");

    expect(replies).toEqual([]);
    expect(await tasks()).toHaveLength(0);
  });

  it("ignores !timer when timerCommandsEnabled is off, even for mods", async () => {
    await db.update(schema.botConfig).set({ timerCommandsEnabled: false });

    expect((await say("!timer start", { isMod: true })).replies).toEqual([]);
    expect(await db.query.timerState.findFirst()).toBeUndefined();
  });

  it("resolves a canonical alias to its command", async () => {
    await db.update(schema.botConfig).set({ commandAliases: { t: "task" } });

    await say("!t hi there");

    expect(await tasks()).toMatchObject([{ text: "hi there", status: "active" }]);
  });

  it("!dwhelp links to the configured docs site", async () => {
    const { replies } = await say("!dwhelp");
    expect(replies).toEqual([
      "Viewer, check out all the commands here: http://localhost:4000/docs/chat-commands",
    ]);
  });
});

describe("bot.ingest chat parsing", () => {
  // Chatterino/7TV append " \u{E0000}" to a repeated line to dodge Twitch's
  // duplicate filter.
  it("ignores the duplicate-bypass suffix on commands", async () => {
    await say("!timer start 2 \u{E0000}", { isMod: true });
    expect((await db.query.timerState.findFirst())?.totalCycles).toBe(2);

    await say("!task write docs \u{E0000}");
    expect((await tasks())[0]?.text).toBe("write docs");
  });

  it("keeps emoji ZWJ sequences in task text", async () => {
    await say("!task 👩‍💻 code");
    expect((await tasks())[0]?.text).toBe("👩‍💻 code");
  });

  it("never lets viewer task text open the reply with a chat command", async () => {
    await db.update(schema.botConfig).set({ msgTaskAdded: "{task} — added for {user}" });

    const bang = await say("!task !ban someone");
    const me = await say("!task /me is the streamer", { username: "other", twitchId: "3000" });

    expect(bang.replies).toEqual(["ban someone — added for Viewer"]);
    expect(me.replies).toEqual(["me is the streamer — added for Viewer"]);
  });
});

describe("bot.ingest !next", () => {
  it("does not announce a replacement when the active task went stale", async () => {
    await say("!task first");
    // A concurrent dashboard/mod completion lands between the command's read of
    // the active task and replaceActiveTask's guarded insert/complete/activate
    // batch (the only three-statement batch on this path).
    const batch = db.batch.bind(db);
    db.batch = (async (statements: Parameters<typeof batch>[0]) => {
      if (statements.length === 3) await db.update(schema.task).set({ status: "done" });
      return batch(statements);
    }) as unknown as typeof db.batch;

    const { replies } = await say("!next second");

    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("try !next again");
    expect((await tasks()).map((t) => t.text)).toEqual(["first"]);
  });

  it("announces the replacement when it happened", async () => {
    await say("!task first");

    const { replies } = await say("!next second");

    expect(replies[0]).toContain("'first'");
    expect(await tasks()).toMatchObject([
      { text: "first", status: "done" },
      { text: "second", status: "active" },
    ]);
  });
});

describe("bot.ingest multi-page dedupe", () => {
  it("runs a message id once even when two bot pages relay it", async () => {
    const id = "b7c1a0e2-1f2d-4c3b-9a8e-123456789abc";

    const first = await say("!task once", { messageId: id });
    const second = await say("!task once", { messageId: id });

    expect(first.replies).toHaveLength(1);
    expect(second.replies).toEqual([]);
    expect(await tasks()).toHaveLength(1);
  });

  it("writes no claim for commands Dirework does not handle", async () => {
    await say("!lurk", { messageId: "c1d2e3f4-0000-4000-8000-000000000001" });
    await db.update(schema.botConfig).set({ taskCommandsEnabled: false });
    await say("!task off", { messageId: "c1d2e3f4-0000-4000-8000-000000000002" });

    expect(await db.query.processedChatMessage.findMany()).toEqual([]);
  });

  it("still runs a command whose message id is malformed, without dedupe", async () => {
    const result = await say("!task x", { messageId: "not an id!" });

    expect(result.replies).toHaveLength(1);
    expect(await tasks()).toHaveLength(1);
    expect(await db.query.processedChatMessage.findMany()).toEqual([]);
  });
});

describe("bot.getSession", () => {
  it("returns only what the IRC client needs — never the refresh token", async () => {
    await db.insert(schema.botAccount).values({
      twitchId: "4000",
      username: "direbot",
      displayName: "DireBot",
      accessToken: "chat-access-token",
      refreshToken: "secret-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const session = await api().bot.getSession({ token: BOT_TOKEN });

    expect(session).toEqual({
      channelName: "streamer",
      botUsername: "direbot",
      chatToken: "chat-access-token",
    });
    expect(JSON.stringify(session)).not.toContain("secret-refresh-token");
  });

  it("rejects a wrong bot token", async () => {
    await expect(api().bot.getSession({ token: "x".repeat(32) })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("reports a dead bot login with the exact message the bot page matches on", async () => {
    await db.insert(schema.botAccount).values({
      twitchId: "4000",
      username: "direbot",
      displayName: "DireBot",
      accessToken: "expired-access-token",
      refreshToken: "revoked-refresh-token",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(api().bot.getSession({ token: BOT_TOKEN })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: BOT_REAUTH_REQUIRED_MESSAGE,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
