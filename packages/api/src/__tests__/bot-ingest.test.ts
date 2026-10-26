import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import { env } from "cloudflare:workers";

import { formatEtaDuration, handleMessage, interpolate } from "../bot/commands";
import {
  COMMAND_HELP_LINES,
  DW_GUIDE_REPLY,
  DW_TASKS_OFF_REPLY,
  DW_TIMER_OFF_REPLY,
  DW_UNKNOWN_REPLY,
} from "../bot/viewer-help";
import type { Context } from "../context";
import {
  BOT_REAUTH_REQUIRED_MESSAGE,
  buildBotConfig,
  CHAT_OPEN_TASK_CAP,
  DEFAULT_TASK_MESSAGES,
  MAX_OPEN_TASKS,
  DEFAULT_TIMER_MESSAGES,
  MAX_CHAT_BYTES,
  utf8ByteLength,
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
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = await createSqliteDb());
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

  // "Z" with five combining marks, "o" with four: kept to two each.
  const ZALGO = "Z̷̢̛̖̗o̶̧̿̀";
  const TRIMMED = "Z̷̢o̶̧";

  it("trims Zalgo stacks on !task, !edit and !next, and in the reply", async () => {
    await db.update(schema.botConfig).set({ msgTaskAdded: "added {task}" });
    const added = await say(`!task ${ZALGO} one`);
    expect(added.replies).toEqual([`added ${TRIMMED} one`]);
    expect((await tasks())[0]?.text).toBe(`${TRIMMED} one`);

    await say(`!edit 1 ${ZALGO} two`);
    expect((await tasks())[0]?.text).toBe(`${TRIMMED} two`);

    await say(`!next ${ZALGO} three`);
    expect((await tasks()).map((t) => t.text)).toContain(`${TRIMMED} three`);
  });

  it("trims Zalgo stacks off the display name the overlay shows", async () => {
    await api().bot.ingest({
      token: BOT_TOKEN,
      kind: "message",
      username: "zalgo",
      displayName: ZALGO,
      twitchId: "2001",
      message: "!task hi",
      isMod: false,
    });
    const row = await db.query.task.findFirst({ columns: { authorDisplayName: true } });
    expect(row?.authorDisplayName).toBe(TRIMMED);
  });

  it("keeps two-mark letters (Vietnamese, Hindi) as typed", async () => {
    const text = "việt hòa क्षि";
    await say(`!task ${text}`);
    expect((await tasks())[0]?.text).toBe(text);
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

describe("bot.ingest owner reads", () => {
  // bot.ingest already reads the owner row to derive chat privileges; the task
  // placement must reuse that answer instead of reading the owner again.
  async function ownerReadsFor(line: string, chatter: Chatter = {}) {
    const spy = vi.spyOn(db.query.user, "findFirst");
    try {
      await say(line, chatter);
      return spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
  }

  it("reads the owner once for !task", async () => {
    expect(await ownerReadsFor("!task one")).toBe(1);
    expect(await ownerReadsFor("!task two")).toBe(1);
  });

  it("reads the owner once for !next, with or without an active task", async () => {
    expect(await ownerReadsFor("!next first")).toBe(1);
    expect(await ownerReadsFor("!next second")).toBe(1);
  });

  it("still pins the streamer's own chat tasks to the top", async () => {
    await say("!task viewer task");
    await say("!task streamer task", { username: "streamer", twitchId: OWNER_TWITCH_ID });
    await say("!next streamer next", { username: "streamer", twitchId: OWNER_TWITCH_ID });

    const rows = await db.query.task.findMany({ columns: { text: true, priority: true } });
    expect(rows).toEqual(
      expect.arrayContaining([
        { text: "viewer task", priority: 1 },
        { text: "streamer task", priority: 0 },
        { text: "streamer next", priority: 0 },
      ]),
    );
  });
});

describe("bot.ingest !next", () => {
  it("does not announce a replacement when the active task went stale", async () => {
    await say("!task first");
    // A concurrent dashboard/mod completion lands between the command's read of
    // the active task and replaceActiveTask's guarded insert/complete/count/
    // activate batch (the only four-statement batch on this path).
    const batch = db.batch.bind(db);
    db.batch = (async (statements: Parameters<typeof batch>[0]) => {
      if (statements.length === 4) await db.update(schema.task).set({ status: "done" });
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

describe("bot.ingest stats cost no extra instance_config read", () => {
  /** Run `line` and return its instance_config reads other than the token gate. */
  async function instanceReads(line: string, chatter?: Chatter) {
    const reads: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      if (/^select[\s\S]*from "instance_config"/i.test(query)) reads.push(query);
      return prepare(query, params);
    });
    try {
      await say(line, chatter);
    } finally {
      spy.mockRestore();
    }
    // The token gate (which selects the zone too) is the only instance_config read allowed.
    return reads.filter((query) => !query.includes('"bot_token"'));
  }

  const broadcaster = { username: "streamer", twitchId: OWNER_TWITCH_ID };

  it("!done, !next and the timer commands read it only through the token gate, which carries the zone", async () => {
    await db.update(schema.instanceConfig).set({ timeZone: "America/Chicago" });
    await say("!task one");
    expect(await instanceReads("!done")).toEqual([]);

    await say("!task two");
    expect(await instanceReads("!next three")).toEqual([]);

    expect(await instanceReads("!timer start", broadcaster)).toEqual([]);
    // Overdue: the advance's credit path must not read the zone again either.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 60 * 60_000);
      expect(await instanceReads("!timer skip", broadcaster)).toEqual([]);
      expect(await instanceReads("!timer reset", broadcaster)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
    const stats = await db.query.dailyStat.findMany();
    expect(stats.reduce((sum, row) => sum + row.tasksDone, 0)).toBe(2);
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

  it("refuses the streamer's real login when their name is not the login", async () => {
    // The owner row's name is a display name; the bot page cached the real IRC login.
    await db.update(schema.user).set({ name: "Streamer Name" });
    await db.update(schema.instanceConfig).set({ channelLogin: "realstreamer" });

    const { replies } = await say("!block @RealStreamer", mod);

    expect(replies).toEqual(["Viewer, I can't block the streamer."]);
    expect((await config()).blockedViewers).toEqual([]);
  });

  describe("when the row changed after ingest read it", () => {
    // Drive handleMessage with a stale snapshot (empty list) while the real row has
    // moved on, i.e. a concurrent !block landed between the read and the guarded UPDATE.
    async function staleBlock(target: string) {
      const replies: string[] = [];
      await handleMessage({
        db,
        channelName: "streamer",
        channelLogin: "streamer",
        config: { ...buildBotConfig(await config()), blockedViewers: [] },
        message: `!block ${target}`,
        userInfo: {
          twitchId: "5000",
          username: "moddy",
          displayName: "Moddy",
          color: null,
          isBroadcaster: false,
          isMod: true,
        },
        say: (text) => replies.push(text),
      });
      return replies;
    }

    it("says already blocked instead of announcing a block", async () => {
      await db.update(schema.botConfig).set({ blockedViewers: ["viewer"] });

      expect(await staleBlock("viewer")).toEqual(["viewer is already blocked."]);
      expect((await config()).blockedViewers).toEqual(["viewer"]);
    });

    it("says the list is full, keeps the viewer's tasks, and does not list them", async () => {
      await say("!task keep me");
      const full = Array.from({ length: 200 }, (_, i) => `name${i}`);
      await db.update(schema.botConfig).set({ blockedViewers: full });

      expect(await staleBlock("viewer")).toEqual([
        "Moddy, the block list is full (200 names). Unblock someone first.",
      ]);
      expect((await config()).blockedViewers).toEqual(full);
      expect((await tasks()).map((t) => t.text)).toEqual(["keep me"]);
    });
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
    ["!dw help", {}],
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
      broadcasterId: OWNER_TWITCH_ID,
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

  it("!focus 2 makes the second task the focus and parks the old one as started", async () => {
    await seedTwo();

    const { replies } = await say("!focus 2");

    expect(replies).toEqual([reply(T.taskCheck, { task: "second thing" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "started" },
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

  it("!done #2 completes the second task, the way !today numbers it", async () => {
    await seedTwo();

    const { replies } = await say("!done #2");

    expect(replies).toEqual([reply(T.taskDone, { task: "second thing" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "active" },
      { text: "second thing", status: "done" },
    ]);
  });

  it("!done with an argument that isn't a number replies with usage and completes nothing", async () => {
    await seedTwo();

    for (const line of ["!done intro", "!done #", "!done 2nd", "!done ##2"]) {
      const { replies } = await say(line);
      expect(replies).toEqual([
        "Viewer, use !done to finish your current task, or !done [number] for another one. !today lists the numbers.",
      ]);
    }
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "active" },
      { text: "second thing", status: "pending" },
    ]);
  });

  it("!edit N and !done N reach a task parked as started by !focus", async () => {
    await seedTwo();
    await say("!focus 2");
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "started" },
      { text: "second thing", status: "active" },
    ]);

    expect((await say("!edit 1 renamed")).replies).toEqual([
      reply(T.taskEdited, { task: "renamed" }),
    ]);
    expect((await say("!done 1")).replies).toEqual([reply(T.taskDone, { task: "renamed" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "renamed", status: "done" },
      { text: "second thing", status: "active" },
    ]);
  });

  it("!remove N removes a started task and leaves the focus", async () => {
    await seedTwo();
    await say("!focus 2");

    expect((await say("!remove 1")).replies).toEqual([
      reply(T.taskRemoved, { task: "first thing" }),
    ]);
    expect(await viewerTasks()).toMatchObject([{ text: "second thing", status: "active" }]);
  });

  it("!remove, !focus and !edit accept a #-prefixed number", async () => {
    await seedTwo();

    expect((await say("!edit #2 renamed")).replies).toEqual([
      reply(T.taskEdited, { task: "renamed" }),
    ]);
    expect((await say("!focus #2")).replies).toEqual([reply(T.taskCheck, { task: "renamed" })]);
    expect(await viewerTasks()).toMatchObject([
      { text: "first thing", status: "started" },
      { text: "renamed", status: "active" },
    ]);

    expect((await say("!remove #1")).replies).toEqual([
      reply(T.taskRemoved, { task: "first thing" }),
    ]);
    expect(await viewerTasks()).toMatchObject([{ text: "renamed", status: "active" }]);
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

  it("!check accepts a target with trailing punctuation or without @", async () => {
    await seedTwo();
    const other = { username: "other", twitchId: "3000" };
    const expected = [reply(T.taskCheckUser, { user2: "Viewer", task: "first thing" })];

    expect((await say("!check @Viewer?", other)).replies).toEqual(expected);
    expect((await say("!check viewer", other)).replies).toEqual(expected);
  });

  it("!check with a target that can't be a login replies with usage", async () => {
    await seedTwo();
    expect((await say("!check @not-a-login")).replies).toEqual([
      "Viewer, use !check for your own task or !check @user for someone else's.",
    ]);
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

  /** Fill the whole instance to MAX_OPEN_TASKS with other viewers' open tasks. */
  async function fillInstance(n = MAX_OPEN_TASKS) {
    await db.insert(schema.task).values(
      Array.from({ length: n }, (_, i) => ({
        id: `fill-${i}`,
        authorTwitchId: String(50_000 + i),
        authorUsername: `filler${i}`,
        authorDisplayName: `Filler${i}`,
        text: `filler ${i}`,
        status: "pending",
        priority: 1,
        order: i + 1,
      })),
    );
  }

  it("!task with the whole list at MAX_OPEN_TASKS replies noTaskAdded and writes nothing", async () => {
    await fillInstance();

    const { replies } = await say("!task one too many");

    expect(replies).toEqual([reply(T.noTaskAdded, { task: "one too many" })]);
    expect(await viewerTasks()).toHaveLength(0);
  });

  it("!next with no focus and a full list replies noTaskAdded", async () => {
    await fillInstance();

    expect((await say("!next over")).replies).toEqual([reply(T.noTaskAdded, { task: "over" })]);
    expect(await viewerTasks()).toHaveLength(0);
  });

  it("!next over a full list keeps the focus and replies noTaskAdded", async () => {
    await say("!task focus");
    await fillInstance(MAX_OPEN_TASKS);

    const { replies } = await say("!next never");

    expect(replies).toEqual([reply(T.noTaskAdded, { task: "never" })]);
    expect(await viewerTasks()).toEqual([
      { text: "focus", status: "active", authorTwitchId: "2000" },
    ]);
  });

  it("strips bidi overrides and invisible characters from chat task text", async () => {
    const { replies } = await say("!task \u202Eabc\u200B def\u2066");

    expect(replies).toEqual([reply(T.taskAdded, { task: "abc def" })]);
    expect((await viewerTasks())[0]?.text).toBe("abc def");
  });

  it("!task with only invisible characters is missing text", async () => {
    const { replies } = await say("!task \u200B\u202E");

    expect(replies).toEqual([reply(T.noTaskContent, { task: "" })]);
    expect(await viewerTasks()).toHaveLength(0);
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

  it("a mod's !clear @user, ignores trailing punctuation", async () => {
    await seedTwo();
    await say("!task theirs", { username: "other", twitchId: "3000" });

    const { replies } = await say("!clear @viewer,", { isMod: true });

    expect(replies).toEqual([reply(T.adminDeleteTasks)]);
    expect(await viewerTasks()).toHaveLength(0);
    expect((await tasks()).map((t) => t.text)).toEqual(["theirs"]);
  });

  it("a mod's !clear @user says so when that viewer had nothing to clear", async () => {
    await seedTwo();
    expect((await say("!clear @nobody", { isMod: true })).replies).toEqual([
      "nobody has no tasks to clear.",
    ]);
    expect(await viewerTasks()).toHaveLength(2);
  });

  it("a mod's !clear @ with an invalid login replies with usage and deletes nothing", async () => {
    await seedTwo();
    const { replies } = await say("!clear @not-a-login", { isMod: true });
    expect(replies[0]).toContain("!clear @user");
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

describe("bot.ingest !start / !pause / !check with started tasks", () => {
  const T = DEFAULT_TASK_MESSAGES;

  async function seed(count: number) {
    for (let i = 1; i <= count; i++) await say(`!task task ${i}`);
  }

  async function statuses() {
    return (await tasks()).filter((t) => t.authorTwitchId === "2000").map((t) => t.status);
  }

  it("!start N starts a waiting task beside the focus and counts what's going", async () => {
    await seed(3);

    expect((await say("!start 2")).replies).toEqual([
      reply(T.taskStarted, { task: "task 2", count: "2", max: "3" }),
    ]);
    expect(await statuses()).toEqual(["active", "started", "pending"]);
    expect(reply(T.taskStarted, { task: "task 2", count: "2", max: "3" })).toBe(
      'Started "task 2", Viewer. 2/3 in progress.',
    );

    expect((await say("!start #3")).replies).toEqual([
      reply(T.taskStarted, { task: "task 3", count: "3", max: "3" }),
    ]);
    expect(await statuses()).toEqual(["active", "started", "started"]);
  });

  it("!start N with no focus makes that task the focus", async () => {
    await seed(1);
    // Pausing the only task leaves nothing going (with another task waiting,
    // pausing the focus would promote that one instead).
    await say("!pause");
    expect(await statuses()).toEqual(["pending"]);

    expect((await say("!start 1")).replies).toEqual([
      reply(T.taskStartedFocus, { task: "task 1" }),
    ]);
    expect(await statuses()).toEqual(["active"]);
  });

  it("!start past the cap refuses without a write and changes nothing", async () => {
    await seed(4);
    await say("!start 2");
    await say("!start 3");

    const statements: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      statements.push(query);
      return prepare(query, params);
    });
    const { replies } = await say("!start 4");
    spy.mockRestore();

    expect(replies).toEqual([reply(T.startCapReached, { max: "3" })]);
    expect(replies[0]).toBe(
      "Viewer, you already have 3 going. Finish one with !done or pause one with !pause.",
    );
    expect(await statuses()).toEqual(["active", "started", "started", "pending"]);
    expect(statements.filter((q) => /^update "task"/i.test(q))).toEqual([]);
  });

  it("two racing !start lines never pass the cap: one starts, one hears the cap", async () => {
    await seed(4);
    await say("!start 2");

    const [a, b] = await Promise.all([say("!start 3"), say("!start 4")]);

    const replies = [...a.replies, ...b.replies];
    expect(replies).toHaveLength(2);
    expect(replies).toContain(reply(T.startCapReached, { max: "3" }));
    expect(replies.filter((r) => r.startsWith("Started"))).toHaveLength(1);
    expect((await statuses()).filter((s) => s === "started")).toHaveLength(2);
  });

  it("a start that lands after the list was read hits the cap inside the guarded UPDATE", async () => {
    await seed(4);
    await say("!start 2");

    // Another bot page starts task 4 between this line's list read (one slot
    // free) and its UPDATE: the cap check in the statement must still refuse.
    const prepare = sqlite.prepare.bind(sqlite);
    let raced = false;
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      if (!raced && /^update "task"/i.test(query)) {
        raced = true;
        sqlite.run(`update task set status = 'started' where text = 'task 4'`);
      }
      return prepare(query, params);
    });
    const { replies } = await say("!start 3");
    spy.mockRestore();

    expect(raced).toBe(true);
    expect(replies).toEqual([reply(T.startCapReached, { max: "3" })]);
    expect(await statuses()).toEqual(["active", "started", "pending", "started"]);
  });

  it("!start and !pause reuse the row they loaded: one task read per line, no re-read", async () => {
    await seed(3);

    /** The task-table reads and batches a chat line makes (D1 round trips). */
    async function taskRoundTrips(line: string) {
      const findFirst = vi.spyOn(db.query.task, "findFirst");
      const findMany = vi.spyOn(db.query.task, "findMany");
      const batch = vi.spyOn(db, "batch");
      try {
        await say(line);
        return {
          reads: findFirst.mock.calls.length + findMany.mock.calls.length,
          batches: batch.mock.calls.length,
        };
      } finally {
        findFirst.mockRestore();
        findMany.mockRestore();
        batch.mockRestore();
      }
    }

    // The open-list read, then startTask's one batch (its status check rides inside it).
    expect(await taskRoundTrips("!start 2")).toEqual({ reads: 1, batches: 1 });
    // The open-list read, then pauseTask's guarded UPDATE.
    expect(await taskRoundTrips("!pause 2")).toEqual({ reads: 1, batches: 0 });
    // Bare !pause: the focus read, then one batch (pause + promote).
    expect(await taskRoundTrips("!pause")).toEqual({ reads: 1, batches: 1 });
    expect(await statuses()).toEqual(["pending", "active", "pending"]);
  });

  it("!check reads only the in-progress rows, never the queue or done history", async () => {
    await seed(12);
    await say("!start 2");
    await say("!done 3");
    await say("!done 3");

    /** Rows each task read returned during `line`, and the plan of each task SELECT. */
    async function taskReads(line: string, chatter?: Chatter) {
      const rows: number[] = [];
      const queries: string[] = [];
      const findMany = vi.spyOn(db.query.task, "findMany");
      const prepare = sqlite.prepare.bind(sqlite);
      const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
        if (/^select[\s\S]*from "task"/i.test(query)) queries.push(query);
        return prepare(query, params);
      });
      try {
        await say(line, chatter);
        for (const result of findMany.mock.results) {
          rows.push(((await result.value) as unknown[]).length);
        }
      } finally {
        findMany.mockRestore();
        spy.mockRestore();
      }
      const plans = queries.map((query) => {
        const params = Array((query.match(/\?/g) ?? []).length).fill("x");
        return JSON.stringify(sqlite.exec(`EXPLAIN QUERY PLAN ${query}`, params));
      });
      return { rows, plans };
    }

    const own = await taskReads("!check");
    expect(own.rows).toEqual([2]);
    expect(own.plans.every((plan) => plan.includes("task_in_progress_author_idx"))).toBe(true);

    const other = await taskReads("!check @viewer", { username: "other", twitchId: "3000" });
    expect(other.rows).toEqual([2]);
    expect(other.plans.every((plan) => plan.includes("task_in_progress_username_lower_idx"))).toBe(
      true,
    );
  });

  it("!start on the focus, a started task or past the end is not startable", async () => {
    await seed(2);
    await say("!start 2");
    const notStartable = reply(T.noTaskToStart);

    expect((await say("!start 1")).replies).toEqual([notStartable]);
    expect((await say("!start 2")).replies).toEqual([notStartable]);
    expect((await say("!start 9")).replies).toEqual([notStartable]);
    expect(await statuses()).toEqual(["active", "started"]);
  });

  it("!start without a number replies with usage", async () => {
    const { replies } = await say("!start");
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("!start [number]");
    expect(replies[0]).toContain("!today");
    expect((await say("!start soon")).replies[0]).toContain("!start [number]");
  });

  it("bare !pause pauses the focus and the next queued task (started first) takes over", async () => {
    await seed(3);
    await say("!start 3");

    expect((await say("!pause")).replies).toEqual([reply(T.taskPaused, { task: "task 1" })]);
    expect(await statuses()).toEqual(["pending", "pending", "active"]);
  });

  it("!pause N pauses a started task back to waiting and leaves the focus", async () => {
    await seed(2);
    await say("!start 2");

    expect((await say("!pause 2")).replies).toEqual([reply(T.taskPaused, { task: "task 2" })]);
    expect(await statuses()).toEqual(["active", "pending"]);
  });

  it("!pause with nothing to pause, or on a waiting task, replies noTaskToPause", async () => {
    expect((await say("!pause")).replies).toEqual([reply(T.noTaskToPause)]);
    await seed(2);
    expect((await say("!pause 2")).replies).toEqual([reply(T.noTaskToPause)]);
    expect((await say("!pause 7")).replies).toEqual([reply(T.noTaskToPause)]);
    expect(await statuses()).toEqual(["active", "pending"]);
  });

  it("!pause with a word replies with usage instead of pausing the focus", async () => {
    await seed(1);
    const { replies } = await say("!pause lunch");
    expect(replies[0]).toContain("!pause [number]");
    expect(await statuses()).toEqual(["active"]);
  });

  it("!check notes how many more tasks are started, for you and for @user", async () => {
    await seed(3);
    expect((await say("!check")).replies).toEqual([reply(T.taskCheck, { task: "task 1" })]);

    await say("!start 2");
    await say("!start 3");
    expect((await say("!check")).replies).toEqual([
      'Viewer, you\'re on "task 1" (+2 more started).',
    ]);
    expect((await say("!check @viewer", { username: "other", twitchId: "3000" })).replies).toEqual([
      'Viewer, Viewer is on "task 1" (+2 more started).',
    ]);
  });

  it("keeps the check note whole beside a long task and a custom template", async () => {
    await say(`!task ${"x".repeat(480)}`);
    await say("!task second");
    await say("!start 2");

    const [line] = (await say("!check")).replies;
    expect(utf8ByteLength(line ?? "")).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(line).toMatch(/…" \(\+1 more started\)\.$/);

    await db.update(schema.botConfig).set({ msgTaskCheck: "{user} works on {task}!" });
    expect((await say("!check")).replies[0]).toMatch(/…! \(\+1 more started\)$/);
  });

  it("follows the task command switch and can be aliased", async () => {
    await seed(2);
    await db.update(schema.botConfig).set({ commandAliases: { go: "start", hold: "pause" } });
    expect((await say("!go 2")).replies).toEqual([
      reply(T.taskStarted, { task: "task 2", count: "2", max: "3" }),
    ]);
    expect((await say("!hold 2")).replies).toEqual([reply(T.taskPaused, { task: "task 2" })]);

    await db.update(schema.botConfig).set({ taskCommandsEnabled: false });
    expect((await say("!start 2")).replies).toEqual([]);
    expect((await say("!pause")).replies).toEqual([]);
    expect(await statuses()).toEqual(["active", "pending"]);
  });

  it("uses the owner's own wording for the new replies", async () => {
    await seed(2);
    await db
      .update(schema.botConfig)
      .set({ msgTaskStarted: "{user} has {count} of {max}: {task}" });
    expect((await say("!start 2")).replies).toEqual(["Viewer has 2 of 3: task 2"]);
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

    // Pausing again says so instead of "isn't running", and changes nothing.
    expect((await mod("!timer pause")).replies).toEqual([
      "The timer is already paused. Use !timer resume to continue.",
    ]);
    expect(await timerRow()).toEqual(paused);

    // A paused timer reports its frozen time left, not "isn't running".
    const pausedEtaReplies = (await mod("!timer eta")).replies;
    const pausedEta = await getTimerEta(db);
    if (!pausedEta || paused?.pausedWithRemaining == null) throw new Error("expected a paused ETA");
    expect(pausedEta.paused).toBe(true);
    expect(pausedEtaReplies).toEqual([
      `The timer is paused with ${formatEtaDuration(paused.pausedWithRemaining)} left in this phase and ${formatEtaDuration(pausedEta.sessionEnd.getTime() - Date.now())} left in the session.`,
    ]);
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
    // Resuming a running timer is a no-op that says it's already running.
    expect((await mod("!timer resume")).replies).toEqual([reply(M.timerRunning)]);

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

    // An older bot page (no verifyBan) removes at once, without asking Twitch.
    expect(result).toEqual({ replies: [], banCleanup: { removed: 2 } });
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

describe("bot.ingest !dw help", () => {
  const claims = () => db.query.processedChatMessage.findMany();
  let nextId = 0;
  const messageId = () => `${String(++nextId).padStart(8, "0")}-0000-4000-8000-0000000000dd`;

  it("!dw and !dw help post the built-in starter guide", async () => {
    for (const line of ["!dw", "!dw help", "!DW  HELP"]) {
      expect((await say(line)).replies, line).toEqual([DW_GUIDE_REPLY("Viewer")]);
    }
  });

  it("keeps the built-in guide when the owner reworded !help", async () => {
    await db.update(schema.botConfig).set({ msgHelp: "Ask the streamer, {user}." });

    expect((await say("!help")).replies).toEqual(["Ask the streamer, Viewer."]);
    expect((await say("!dw help")).replies).toEqual([DW_GUIDE_REPLY("Viewer")]);
  });

  it("!dw help <command> explains one command, by name, !name, any case or alias", async () => {
    await db.update(schema.botConfig).set({ commandAliases: { add: "task" } });
    const taskLine = `Viewer, ${COMMAND_HELP_LINES.task}`;

    for (const line of ["!dw help task", "!DW  HELP  !TASK", "!dw help add", "!dw task"]) {
      expect((await say(line)).replies, line).toEqual([taskLine]);
    }
    expect((await say("!dw help clear")).replies[0]).toContain("(mods only)");
  });

  it("!dw help start and !dw help pause explain the new commands", async () => {
    expect((await say("!dw help start")).replies).toEqual([`Viewer, ${COMMAND_HELP_LINES.start}`]);
    expect((await say("!dw help !PAUSE")).replies).toEqual([`Viewer, ${COMMAND_HELP_LINES.pause}`]);
    expect(COMMAND_HELP_LINES.start).toContain("3 going at once");
    await db.update(schema.botConfig).set({ taskCommandsEnabled: false });
    expect((await say("!dw help start")).replies).toEqual([DW_TASKS_OFF_REPLY("Viewer")]);
  });

  it("answers an unknown command with a friendly example, never echoing it", async () => {
    const { replies } = await say("!dw help lurk");
    expect(replies).toEqual([DW_UNKNOWN_REPLY("Viewer")]);
    expect(replies[0]).not.toContain("lurk");
  });

  it("!dw commands lists every command like !dwcommands", async () => {
    const { replies } = await say("!dw commands");
    expect(replies).toEqual((await say("!dwcommands")).replies);
    expect(replies[0]).toContain("/docs/chat-commands");
  });

  it("says the task list is off instead of teaching task commands", async () => {
    await db.update(schema.botConfig).set({ taskCommandsEnabled: false });

    expect((await say("!dw help")).replies).toEqual([DW_TASKS_OFF_REPLY("Viewer")]);
    expect((await say("!dw help done")).replies).toEqual([DW_TASKS_OFF_REPLY("Viewer")]);
    // Moderation commands still answer, so they are still explained.
    expect((await say("!dw help mute")).replies).toEqual([`Viewer, ${COMMAND_HELP_LINES.mute}`]);
  });

  it("says the timer commands are off when they are", async () => {
    await db.update(schema.botConfig).set({ timerCommandsEnabled: false });
    expect((await say("!dw help timer")).replies).toEqual([DW_TIMER_OFF_REPLY("Viewer")]);
  });

  it("is ignored while muted, and for a blocked viewer, with no claim", async () => {
    await db.update(schema.botConfig).set({ muted: true });
    expect(await say("!dw help", { messageId: messageId() })).toEqual({
      replies: [],
      muted: true,
    });

    await db.update(schema.botConfig).set({ muted: false, blockedViewers: ["viewer"] });
    expect((await say("!dw help", { messageId: messageId() })).replies).toEqual([]);
    expect(await claims()).toEqual([]);
  });

  it("answers once when two bot pages relay the same line, writing only the claim", async () => {
    const id = messageId();
    const before = await config();

    const first = await say("!dw help task", { messageId: id });
    const second = await say("!dw help task", { messageId: id });

    expect(first.replies).toHaveLength(1);
    expect(second.replies).toEqual([]);
    expect(await claims()).toHaveLength(1);
    expect(await tasks()).toEqual([]);
    expect(await config()).toEqual(before);
  });
});

describe("bot dock buttons (getSession identity → ingest as the broadcaster)", () => {
  // The dock sends each button as a chat line from the identity getSession returned, with no
  // mod claim and a fresh message id per click. These pin that the server grants that line
  // broadcaster rights — so no new procedure is needed — and that mute still lets it unmute.
  async function dockIdentity() {
    await db.insert(schema.botAccount).values({
      twitchId: "4000",
      username: "direbot",
      displayName: "DireBot",
      accessToken: "chat-access-token",
      refreshToken: "secret-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    const session = await api().bot.getSession({ token: BOT_TOKEN });
    if (!session.broadcasterId) throw new Error("getSession returned no broadcasterId");
    return { username: session.channelName, twitchId: session.broadcasterId, isMod: false };
  }
  let clicks = 0;
  const clickId = () => `00000000-0000-4000-8000-${String(++clicks).padStart(12, "0")}`;

  it("runs mod-only timer and clear commands", async () => {
    const dock = await dockIdentity();
    await seedTasks();

    await say("!timer start", { ...dock, messageId: clickId() });
    expect((await timerRow())?.status).toBe("starting");

    await say("!clear done", { ...dock, messageId: clickId() });
    expect((await tasks()).map((t) => t.text)).toEqual(["viewer one"]);
  });

  it("mutes, and unmutes while muted", async () => {
    const dock = await dockIdentity();

    expect(await say("!mute", { ...dock, messageId: clickId() })).toMatchObject({ muted: true });
    expect(await say("!unmute", { ...dock, messageId: clickId() })).toMatchObject({
      muted: false,
    });
  });
});
