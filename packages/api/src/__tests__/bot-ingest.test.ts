import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import { env } from "cloudflare:workers";

import { formatEtaDuration, interpolate } from "../bot/commands";
import type { Context } from "../context";
import {
  BOT_REAUTH_REQUIRED_MESSAGE,
  CHAT_OPEN_TASK_CAP,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
} from "../config-shared";
import { getTimerEta } from "../services/timer-service";
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

async function timerRow() {
  return db.query.timerState.findFirst();
}

/** The reply a default template produces for the default "Viewer" chatter. */
function reply(template: string, vars: Record<string, string> = {}) {
  return interpolate(template, { user: "Viewer", channel: "streamer", ...vars });
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

    expect(replies).toEqual([reply(DEFAULT_TASK_MESSAGES.notMod)]);
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

    expect(replies).toEqual([reply(DEFAULT_TASK_MESSAGES.notMod)]);
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

describe("bot.ingest !today", () => {
  it("summarizes only the viewer's active and queued tasks", async () => {
    await say("!task First task");
    await say("!task Second task");
    await say("!task Someone else's task", { username: "other", twitchId: "3000" });

    const { replies } = await say("!today");

    expect(replies).toEqual(["Viewer's plan: Now: #1 First task · Next: #2 Second task"]);
    expect(replies[0]).not.toContain("Someone else's task");
  });

  it("uses the existing no-task reply when the viewer has no open tasks", async () => {
    const { replies } = await say("!today");
    expect(replies).toEqual([reply(DEFAULT_TASK_MESSAGES.noTask)]);
  });
});

describe("bot.ingest default reply wording", () => {
  // A provisioned row holds the frozen SQL column defaults (an older wording); the bot
  // must reply with the current defaults until the owner customizes a line.
  it("replies with the current default wording for a never-customized row", async () => {
    expect((await config()).msgNoTask).not.toBe(DEFAULT_TASK_MESSAGES.noTask);
    expect((await say("!check")).replies).toEqual([reply(DEFAULT_TASK_MESSAGES.noTask)]);
  });

  it("keeps a line the owner customized", async () => {
    await db.update(schema.botConfig).set({ msgNoTask: "Nope, {user}." });
    expect((await say("!check")).replies).toEqual(["Nope, Viewer."]);
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
      "Viewer, the full command list is here: http://localhost:4000/docs/chat-commands",
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

    expect(replies[0]).toContain('"first"');
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

describe("bot.ingest moderation", () => {
  const mod = { isMod: true };
  const broadcaster = { username: "streamer", twitchId: OWNER_TWITCH_ID };
  const claims = () => db.query.processedChatMessage.findMany();
  let nextId = 0;
  /** A fresh, well-formed IRC message id, so every claim is observable. */
  const messageId = () => `${String(++nextId).padStart(8, "0")}-0000-4000-8000-000000000000`;

  it("a blocked viewer's command gets no reply, no task, and no claim", async () => {
    await db.update(schema.botConfig).set({ blockedViewers: ["viewer"] });

    const result = await say("!task sneaky", { messageId: messageId() });

    expect(result.replies).toEqual([]);
    expect(await tasks()).toEqual([]);
    expect(await claims()).toEqual([]);
  });

  it("a mod's !block lists the login and removes only that viewer's tasks", async () => {
    await seedTasks();

    const { replies } = await say("!block @VIEWER", mod);

    expect(replies).toEqual(["Blocked viewer and removed their tasks."]);
    expect((await tasks()).map((t) => t.text)).toEqual(["other one"]);
    expect((await config()).blockedViewers).toEqual(["viewer"]);
  });

  it("blocking an already-blocked viewer says so and changes nothing", async () => {
    await say("!block @viewer", { ...mod, username: "moddy", twitchId: "5000" });
    const { replies } = await say("!block viewer", { ...mod, username: "moddy", twitchId: "5000" });

    expect(replies).toEqual(["viewer is already blocked."]);
    expect((await config()).blockedViewers).toEqual(["viewer"]);
  });

  it("the streamer can't be blocked", async () => {
    const { replies } = await say("!block @streamer", mod);

    expect(replies).toEqual(["Viewer, I can't block the streamer."]);
    expect((await config()).blockedViewers).toEqual([]);
  });

  it("the broadcaster's commands run even if their login is on the list", async () => {
    await db.update(schema.botConfig).set({ blockedViewers: ["streamer"] });

    const { replies } = await say("!task still mine", broadcaster);

    expect(replies).toHaveLength(1);
    expect((await tasks()).map((t) => t.text)).toEqual(["still mine"]);
  });

  it("!unblock restores commands but not the removed tasks", async () => {
    await say("!task before block");
    await say("!block viewer", { ...mod, username: "moddy", twitchId: "5000" });

    const { replies } = await say("!unblock @Viewer", {
      ...mod,
      username: "moddy",
      twitchId: "5000",
    });
    expect(replies).toEqual(["Unblocked viewer. Their commands work again."]);
    expect((await config()).blockedViewers).toEqual([]);

    await say("!task after unblock");
    expect((await tasks()).map((t) => t.text)).toEqual(["after unblock"]);
  });

  it("!unblock of someone not on the list says so", async () => {
    expect((await say("!unblock nobody", mod)).replies).toEqual(["nobody isn't blocked."]);
  });

  it.each(["!block", "!block @", "!block bad-name!"])("%j replies with usage", async (line) => {
    const { replies } = await say(line, mod);

    expect(replies).toEqual(["Viewer, tell me who to block: !block @user."]);
    expect((await config()).blockedViewers).toEqual([]);
  });

  it("!unblock with no target replies with usage", async () => {
    expect((await say("!unblock", mod)).replies).toEqual([
      "Viewer, tell me who to unblock: !unblock @user.",
    ]);
  });

  it("a non-mod !block is refused with notMod", async () => {
    const { replies } = await say("!block @someone");

    expect(replies).toEqual([reply(DEFAULT_TASK_MESSAGES.notMod)]);
    expect((await config()).blockedViewers).toEqual([]);
  });

  it("a mod's !mute flips the switch and reports muted", async () => {
    const result = await say("!mute", mod);

    expect(result.replies).toEqual([
      "Muted. I'll ignore commands and stay quiet until a mod sends !unmute.",
    ]);
    expect(result.muted).toBe(true);
    expect((await config()).muted).toBe(true);
  });

  it("a non-mod !mute is refused with notMod", async () => {
    const result = await say("!mute");

    expect(result.replies).toEqual([reply(DEFAULT_TASK_MESSAGES.notMod)]);
    expect(result.muted).toBe(false);
    expect((await config()).muted).toBe(false);
  });

  it.each<[string, Chatter]>([
    ["!task muted", {}],
    ["!timer start", mod],
    ["!dwhelp", {}],
    ["!block @someone", mod],
    ["!unmute", {}],
  ])("while muted, %j is ignored with no claim and no write", async (line, chatter) => {
    await db.update(schema.botConfig).set({ muted: true });

    const result = await say(line, { ...chatter, messageId: messageId() });

    expect(result).toEqual({ replies: [], muted: true });
    expect(await claims()).toEqual([]);
    expect(await tasks()).toEqual([]);
    expect(await timerRow()).toBeUndefined();
    expect(await config()).toMatchObject({ muted: true, blockedViewers: [] });
  });

  it("a mod's !unmute while muted turns commands back on", async () => {
    await db.update(schema.botConfig).set({ muted: true });

    const result = await say("!unmute", mod);

    expect(result).toEqual({ replies: ["Unmuted. Commands are back on."], muted: false });
    expect((await config()).muted).toBe(false);
  });

  it("!unmute when not muted says so", async () => {
    const result = await say("!unmute", mod);

    expect(result).toEqual({ replies: ["Viewer, I'm not muted."], muted: false });
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
      aliases: [],
      muted: false,
    });
    expect(JSON.stringify(session)).not.toContain("secret-refresh-token");
  });

  it("reports the mute switch from the same bot_config read", async () => {
    await db.insert(schema.botAccount).values({
      twitchId: "4000",
      username: "direbot",
      displayName: "DireBot",
      accessToken: "chat-access-token",
      refreshToken: "secret-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    await db.update(schema.botConfig).set({ muted: true });

    expect((await api().bot.getSession({ token: BOT_TOKEN })).muted).toBe(true);
  });

  it("returns the configured alias keys so the bot page can skip other bots' commands", async () => {
    await db.insert(schema.botAccount).values({
      twitchId: "4000",
      username: "direbot",
      displayName: "DireBot",
      accessToken: "chat-access-token",
      refreshToken: "secret-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    // A legacy record with a bang and capitals resolves as "t" on the server.
    await db.update(schema.botConfig).set({ commandAliases: { "!T": "!task", add: "task" } });

    const session = await api().bot.getSession({ token: BOT_TOKEN });

    expect(session.aliases).toEqual(["t", "add"]);
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

describe("bot.ingest task commands end to end", () => {
  const T = DEFAULT_TASK_MESSAGES;

  async function seedTwo() {
    await say("!task first thing");
    await say("!task second thing");
  }

  async function viewerTasks() {
    return (await tasks()).filter((t) => t.authorTwitchId === "2000");
  }

  it("!remove 2 removes only the second task", async () => {
    await seedTwo();

    const { replies } = await say("!remove 2");

    expect(replies).toEqual([reply(T.taskRemoved, { task: "second thing" })]);
    expect(await viewerTasks()).toEqual([
      { text: "first thing", status: "active", authorTwitchId: "2000" },
    ]);
  });

  it("!remove with an out-of-range position replies noTask and removes nothing", async () => {
    await seedTwo();

    const { replies } = await say("!remove 9");

    expect(replies).toEqual([reply(T.noTask)]);
    expect(await viewerTasks()).toHaveLength(2);
  });

  it("!remove with a non-numeric arg replies with usage, not noTask", async () => {
    await seedTwo();

    const { replies } = await say("!remove abc");

    expect(replies).toHaveLength(1);
    expect(replies[0]).not.toBe(reply(T.noTask));
    expect(replies[0]).toContain("!remove [number]");
    expect(replies[0]).toContain("Viewer");
    expect(await viewerTasks()).toHaveLength(2);
  });

  it("!focus without a position replies with usage and changes nothing", async () => {
    await seedTwo();

    const { replies } = await say("!focus");

    expect(replies[0]).toContain("!focus [number]");
    expect(replies[0]).toContain("!today");
    expect((await viewerTasks()).map((t) => t.status)).toEqual(["active", "pending"]);
  });

  it("!remove without a number replies with usage even with no open tasks (no task read)", async () => {
    const { replies } = await say("!remove");
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("!remove [number]");
    expect(replies[0]).toContain("!today");
  });

  it("!edit 1 rewrites the first task's text", async () => {
    await seedTwo();

    const { replies } = await say("!edit 1 new text");

    expect(replies).toEqual([reply(T.taskEdited, { task: "new text" })]);
    expect((await viewerTasks()).map((t) => t.text)).toEqual(["new text", "second thing"]);
  });

  it("!edit without text, or past the end, replies noTaskToEdit and changes nothing", async () => {
    await seedTwo();

    expect((await say("!edit 1")).replies).toEqual([reply(T.noTaskToEdit)]);
    expect((await say("!edit 5 nope")).replies).toEqual([reply(T.noTaskToEdit)]);
    expect((await viewerTasks()).map((t) => t.text)).toEqual(["first thing", "second thing"]);
  });

  it("!focus 2 makes the second task the sole active one", async () => {
    await seedTwo();

    const { replies } = await say("!focus 2");

    expect(replies).toEqual([reply(T.taskCheck, { task: "second thing" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "pending" },
      { text: "second thing", status: "active" },
    ]);
  });

  it("!focus past the end replies noTask", async () => {
    await seedTwo();

    expect((await say("!focus 3")).replies).toEqual([reply(T.noTask)]);
    expect((await viewerTasks()).map((t) => t.status)).toEqual(["active", "pending"]);
  });

  it("!done 2 completes the second task and leaves the first active", async () => {
    await seedTwo();

    const { replies } = await say("!done 2");

    expect(replies).toEqual([reply(T.taskDone, { task: "second thing" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "active" },
      { text: "second thing", status: "done" },
    ]);
  });

  it("!done with nothing open replies noTask", async () => {
    expect((await say("!done")).replies).toEqual([reply(T.noTask)]);
    expect((await say("!done 1")).replies).toEqual([reply(T.noTask)]);
  });

  it("!check @USER looks up another viewer's active task case-insensitively", async () => {
    await seedTwo();

    const { replies } = await say("!check @VIEWER", { username: "other", twitchId: "3000" });

    expect(replies).toEqual([reply(T.taskCheckUser, { user2: "Viewer", task: "first thing" })]);
  });

  it("!check @user with no active task replies noTaskOther", async () => {
    expect((await say("!check @nobody")).replies).toEqual([reply(T.noTaskOther)]);
  });

  it("!check reports the chatter's own active task, or noTask", async () => {
    expect((await say("!check")).replies).toEqual([reply(T.noTask)]);
    await seedTwo();
    expect((await say("!check")).replies).toEqual([reply(T.taskCheck, { task: "first thing" })]);
  });

  it("!task with no text replies noTaskContent and creates nothing", async () => {
    const { replies } = await say("!task");

    expect(replies).toEqual([reply(T.noTaskContent, { task: "" })]);
    expect(await tasks()).toHaveLength(0);
  });

  it("!task at the open-task cap replies noTaskAdded and creates nothing", async () => {
    for (let i = 0; i < CHAT_OPEN_TASK_CAP; i++) await say(`!task t${i}`);
    expect(await viewerTasks()).toHaveLength(CHAT_OPEN_TASK_CAP);

    const { replies } = await say("!task one too many");

    expect(replies).toEqual([reply(T.noTaskAdded, { task: "one too many" })]);
    expect(await viewerTasks()).toHaveLength(CHAT_OPEN_TASK_CAP);
  });

  it("!next with no text replies nextNoContent", async () => {
    expect((await say("!next")).replies).toEqual([reply(T.nextNoContent)]);
    expect(await tasks()).toHaveLength(0);
  });

  it("!next with no active task adds the task as active and replies taskAdded", async () => {
    await say("!task old");
    await say("!done");

    const { replies } = await say("!next fresh");

    expect(replies).toEqual([reply(T.taskAdded, { task: "fresh" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "old", status: "done" },
      { text: "fresh", status: "active" },
    ]);
  });

  it("!next at the cap with no active task replies noTaskAdded", async () => {
    for (let i = 0; i < CHAT_OPEN_TASK_CAP; i++) await say(`!task t${i}`);
    await db.update(schema.task).set({ status: "pending" });

    const { replies } = await say("!next over");

    expect(replies).toEqual([reply(T.noTaskAdded)]);
    const after = await viewerTasks();
    expect(after).toHaveLength(CHAT_OPEN_TASK_CAP);
    expect(after.some((t) => t.status === "active")).toBe(false);
  });

  it("!next at the cap still replaces the active task (the cap counts after completion)", async () => {
    for (let i = 0; i < CHAT_OPEN_TASK_CAP; i++) await say(`!task t${i}`);

    const { replies } = await say("!next swap");

    expect(replies).toEqual([reply(T.taskNext, { oldTask: "t0", newTask: "swap" })]);
    const open = (await viewerTasks()).filter((t) => t.status !== "done");
    expect(open).toHaveLength(CHAT_OPEN_TASK_CAP);
  });

  it("!help replies with the configured help template", async () => {
    expect((await say("!help")).replies).toEqual([reply(T.help)]);
  });

  it("!dwhelp falls back to an inline command list when no docs URL is configured", async () => {
    // The Workers env is read-only in production; the Vitest stub is a plain object.
    const stubEnv = env as { DOCS_URL: string };
    const original = stubEnv.DOCS_URL;
    stubEnv.DOCS_URL = "";
    try {
      const { replies } = await say("!dwhelp");
      expect(replies).toHaveLength(1);
      expect(replies[0]).toMatch(/^Viewer, available commands: /);
      expect(replies[0]).toContain("!timer (mods)");
      expect(replies[0]).toContain("!mute");
      expect(replies[0]).not.toContain("http");
    } finally {
      stubEnv.DOCS_URL = original;
    }
  });

  it("a non-mod !clear is refused with notMod", async () => {
    await seedTwo();
    expect((await say("!clear done")).replies).toEqual([reply(T.notMod)]);
    expect(await viewerTasks()).toHaveLength(2);
  });

  it("a mod's !clear with no target replies with the targets and deletes nothing", async () => {
    await seedTwo();
    const { replies } = await say("!clear", { isMod: true });
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("!clear done");
    expect(replies[0]).toContain("!clear all");
    expect(replies[0]).toContain("!clear @user");
    expect(await viewerTasks()).toHaveLength(2);
  });
});

describe("bot.ingest !timer subcommands", () => {
  const M = DEFAULT_TIMER_MESSAGES;
  const mod = (message: string) => say(message, { isMod: true });

  it("walks start → running → pause → resume → skip → eta → reset", async () => {
    expect((await mod("!timer start 0")).replies).toEqual([reply(M.cycleWrong)]);
    expect((await mod("!timer start 100")).replies).toEqual([reply(M.cycleWrong)]);
    expect((await mod("!timer start x")).replies).toEqual([reply(M.cycleWrong)]);
    expect(await timerRow()).toBeUndefined();

    // Nothing to pause/resume/skip/eta before the timer exists.
    for (const sub of ["pause", "resume", "skip", "eta"]) {
      expect((await mod(`!timer ${sub}`)).replies).toEqual([reply(M.notRunning)]);
    }

    expect((await mod("!timer start")).replies).toEqual([reply(M.commandSuccess)]);
    const started = await timerRow();
    expect(started).toMatchObject({ status: "starting", currentCycle: 1, totalCycles: 4 });
    expect(started?.targetEndTime).toBeInstanceOf(Date);

    expect((await mod("!timer start")).replies).toEqual([reply(M.timerRunning)]);

    expect((await mod("!timer pause")).replies).toEqual([reply(M.commandSuccess)]);
    const paused = await timerRow();
    expect(paused).toMatchObject({
      status: "paused",
      pausedFromStatus: "starting",
      targetEndTime: null,
    });
    expect(paused?.pausedWithRemaining).toEqual(expect.any(Number));

    // A paused timer has no end time to project.
    expect((await mod("!timer eta")).replies).toEqual([reply(M.notRunning)]);
    // Starting over a paused timer is refused like any running state.
    expect((await mod("!timer start")).replies).toEqual([reply(M.timerRunning)]);

    expect((await mod("!timer resume")).replies).toEqual([reply(M.commandSuccess)]);
    const resumed = await timerRow();
    expect(resumed).toMatchObject({
      status: "starting",
      pausedFromStatus: null,
      pausedWithRemaining: null,
    });
    expect(resumed?.targetEndTime).toBeInstanceOf(Date);
    // Resuming a timer that isn't paused is a no-op.
    expect((await mod("!timer resume")).replies).toEqual([reply(M.notRunning)]);

    expect((await mod("!timer skip")).replies).toEqual([reply(M.commandSuccess)]);
    expect(await timerRow()).toMatchObject({ status: "work", currentCycle: 1 });

    const etaReplies = (await mod("!timer eta")).replies;
    const eta = await getTimerEta(db);
    if (!eta) throw new Error("expected an ETA for a running timer");
    const now = Date.now();
    expect(etaReplies).toEqual([
      reply(M.eta, {
        phase: formatEtaDuration(eta.phaseEnd.getTime() - now),
        time: formatEtaDuration(eta.sessionEnd.getTime() - now),
      }),
    ]);

    expect((await mod("!timer reset")).replies).toEqual([reply(M.commandSuccess)]);
    expect(await timerRow()).toMatchObject({
      status: "idle",
      targetEndTime: null,
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 1,
      totalCycles: 4,
    });

    // An idle timer can be started again, with an explicit cycle count.
    expect((await mod("!timer start 2")).replies).toEqual([reply(M.commandSuccess)]);
    expect(await timerRow()).toMatchObject({ status: "starting", totalCycles: 2 });
  });

  it("an unknown or missing subcommand replies wrongCommand and writes nothing", async () => {
    expect((await mod("!timer bogus")).replies).toEqual([reply(M.wrongCommand)]);
    expect((await mod("!timer")).replies).toEqual([reply(M.wrongCommand)]);
    expect(await timerRow()).toBeUndefined();
  });

  it("a non-mod !timer start gets the notMod reply", async () => {
    expect((await say("!timer start")).replies).toEqual([reply(DEFAULT_TASK_MESSAGES.notMod)]);
    expect(await timerRow()).toBeUndefined();
  });
});

describe("bot.ingest clearchat", () => {
  it("a ban/timeout removes only the target user's tasks", async () => {
    await say("!task viewer a");
    await say("!task viewer b");
    await say("!task other a", { username: "other", twitchId: "3000" });

    const result = await api().bot.ingest({
      token: BOT_TOKEN,
      kind: "clearchat",
      targetUsername: "viewer",
    });

    expect(result).toEqual({ replies: [] });
    expect(await tasks()).toEqual([{ text: "other a", status: "active", authorTwitchId: "3000" }]);
  });

  it("rejects a clearchat with a wrong bot token and removes nothing", async () => {
    await say("!task keep me");

    await expect(
      api().bot.ingest({ token: "x".repeat(32), kind: "clearchat", targetUsername: "viewer" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await tasks()).toHaveLength(1);
  });
});

describe("bot.getSession without a bot account", () => {
  it("rejects NOT_FOUND so the bot page shows its not-configured state", async () => {
    await expect(api().bot.getSession({ token: BOT_TOKEN })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
