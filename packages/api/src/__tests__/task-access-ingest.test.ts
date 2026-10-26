import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import { BAN_CHECK_SCOPE, FOLLOWER_CHECK_SCOPE, type TaskAccessLevel } from "../bot-permissions";
import { interpolate } from "../bot/commands";
import { DEFAULT_TASK_MESSAGES } from "../config-shared";
import type { Context } from "../context";
import { appRouter } from "../routers/index";
import { NOT_FOLLOWER_CACHE_MS } from "../services/follower-check";
import { createSqliteDb } from "./helpers/sqlite-db";

/**
 * "Who can add tasks" and ban cleanup through the REAL appRouter over real SQLite, with
 * Twitch's Helix stubbed at `fetch`: which chatters a level admits, when the follower
 * cache is read and written, how many Twitch calls a viewer costs, and when a ban removes
 * tasks.
 */

const BOT_TOKEN = "bot-token-0123456789abcdef";
const OWNER_TWITCH_ID = "1000";
const BOT_TWITCH_ID = "4000";
const VIEWER_ID = "2000";
const T = DEFAULT_TASK_MESSAGES;

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

afterEach(() => {
  vi.unstubAllGlobals();
});

const api = () => appRouter.createCaller({ session: null, db } as unknown as Context);

interface Chatter {
  username?: string;
  twitchId?: string;
  isMod?: boolean;
  isVip?: boolean;
  isSubscriber?: boolean;
}

function say(message: string, chatter: Chatter = {}) {
  return api().bot.ingest({
    token: BOT_TOKEN,
    kind: "message",
    username: chatter.username ?? "viewer",
    displayName: "Viewer",
    twitchId: chatter.twitchId ?? VIEWER_ID,
    message,
    isMod: chatter.isMod ?? false,
    isVip: chatter.isVip,
    isSubscriber: chatter.isSubscriber,
  });
}

const reply = (template: string) => interpolate(template, { user: "Viewer", channel: "streamer" });

async function setLevel(taskAccess: TaskAccessLevel) {
  await db.update(schema.botConfig).set({ taskAccess });
}

async function connectBot(opts: { twitchId?: string; scopes?: string[] } = {}) {
  await db.insert(schema.botAccount).values({
    twitchId: opts.twitchId ?? BOT_TWITCH_ID,
    username: "direbot",
    displayName: "DireBot",
    accessToken: "bot-access-token",
    refreshToken: "bot-refresh-token",
    expiresAt: new Date(Date.now() + 3_600_000),
    scopes: opts.scopes ?? ["chat:read", "chat:edit", FOLLOWER_CHECK_SCOPE, BAN_CHECK_SCOPE],
  });
}

/** Stub Helix: `respond` answers each call; every call's URL is recorded. */
function stubHelix(respond: (url: URL) => Response | Promise<Response>) {
  const calls: URL[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    return respond(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const followers = (ids: string[]) =>
  json({ data: ids.map((user_id) => ({ user_id, user_login: "v", user_name: "V" })), total: 9 });

const taskTexts = async () => (await db.query.task.findMany()).map((task) => task.text);
const followRows = () => db.query.followerCheck.findMany();

describe("who can add tasks: badge levels", () => {
  it("everyone (the default) lets any viewer add, with no Twitch call", async () => {
    const calls = stubHelix(() => followers([]));

    expect((await say("!task read")).replies).toEqual([
      interpolate(T.taskAdded, { user: "Viewer", task: "read" }),
    ]);
    expect(calls).toHaveLength(0);
  });

  it("subscribers refuses a plain viewer and admits subs, VIPs, mods and the broadcaster", async () => {
    await setLevel("subscribers");

    expect((await say("!task plain")).replies).toEqual([reply(T.notSubscriber)]);
    await say("!task sub", { twitchId: "2001", isSubscriber: true });
    await say("!task vip", { twitchId: "2002", isVip: true });
    await say("!task mod", { twitchId: "2003", isMod: true });
    await say("!task owner", { twitchId: OWNER_TWITCH_ID });

    expect((await taskTexts()).sort()).toEqual(["mod", "owner", "sub", "vip"]);
  });

  it("vips refuses a subscriber with its own reply", async () => {
    await setLevel("vips");

    expect((await say("!task sub", { isSubscriber: true })).replies).toEqual([reply(T.notVip)]);
    await say("!task vip", { isVip: true });
    expect(await taskTexts()).toEqual(["vip"]);
  });

  it("gates !next too, but leaves commands on existing tasks alone", async () => {
    await say("!task first");
    await setLevel("subscribers");

    expect((await say("!next second")).replies).toEqual([reply(T.notSubscriber)]);
    expect((await say("!done")).replies).toEqual([
      interpolate(T.taskDone, { user: "Viewer", task: "first" }),
    ]);
    expect(await taskTexts()).toEqual(["first"]);
  });

  it("answers a task-less !task with the usage reply before checking access", async () => {
    await setLevel("subscribers");
    expect((await say("!task")).replies).toEqual([reply(T.noTaskContent)]);
  });
});

describe("who can add tasks: followers", () => {
  beforeEach(async () => {
    await setLevel("followers");
  });

  it("asks Twitch once as the bot, adds the task, and caches the follow", async () => {
    await connectBot();
    const calls = stubHelix(() => followers([VIEWER_ID]));

    await say("!task one");
    await say("!task two");

    expect(await taskTexts()).toHaveLength(2);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.pathname).toBe("/helix/channels/followers");
    expect(call?.searchParams.get("broadcaster_id")).toBe(OWNER_TWITCH_ID);
    expect(call?.searchParams.get("user_id")).toBe(VIEWER_ID);
    expect(await followRows()).toMatchObject([{ twitchId: VIEWER_ID, following: true }]);
  });

  it("sends the bot's token, never a refresh", async () => {
    await connectBot();
    const fetchMock = vi.fn(async () => followers([VIEWER_ID]));
    vi.stubGlobal("fetch", fetchMock);

    await say("!task one");

    const init = (fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1];
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer bot-access-token");
  });

  it("refuses a non-follower and trusts that answer only for a few minutes", async () => {
    await connectBot();
    const calls = stubHelix(() => followers([]));

    expect((await say("!task one")).replies).toEqual([reply(T.notFollower)]);
    expect((await say("!task two")).replies).toEqual([reply(T.notFollower)]);
    expect(calls).toHaveLength(1);

    // Past the negative TTL, the next command asks again.
    await db
      .update(schema.followerCheck)
      .set({ checkedAt: new Date(Date.now() - NOT_FOLLOWER_CACHE_MS - 1) });
    await say("!task three");
    expect(calls).toHaveLength(2);
    expect(await taskTexts()).toEqual([]);
  });

  it("lets subscribers, VIPs and mods in without a lookup", async () => {
    await connectBot();
    const calls = stubHelix(() => followers([]));

    await say("!task sub", { twitchId: "2001", isSubscriber: true });
    await say("!task vip", { twitchId: "2002", isVip: true });
    await say("!task mod", { twitchId: "2003", isMod: true });

    expect(calls).toHaveLength(0);
    expect(await followRows()).toEqual([]);
  });

  it("fails closed when Twitch errors, caching nothing", async () => {
    await connectBot();
    const calls = stubHelix(() => json({ message: "busy" }, 503));

    expect((await say("!task one")).replies).toEqual([reply(T.followCheckFailed)]);
    await say("!task two");

    expect(calls).toHaveLength(2);
    expect(await followRows()).toEqual([]);
    expect(await taskTexts()).toEqual([]);
  });

  it("fails closed without calling Twitch when the bot lacks the follower scope", async () => {
    await connectBot({ scopes: ["chat:read", "chat:edit"] });
    const calls = stubHelix(() => followers([VIEWER_ID]));

    expect((await say("!task one")).replies).toEqual([reply(T.followCheckFailed)]);
    expect(calls).toHaveLength(0);
  });

  it("refreshes an expiring bot token before asking", async () => {
    await connectBot();
    await db.update(schema.botAccount).set({ expiresAt: new Date(Date.now() + 1000) });
    const calls = stubHelix((url) =>
      url.hostname === "id.twitch.tv"
        ? json({ access_token: "fresh-token", refresh_token: "fresh-refresh", expires_in: 3600 })
        : followers([VIEWER_ID]),
    );

    await say("!task one");

    expect(calls.map((url) => url.pathname)).toEqual([
      "/oauth2/token",
      "/helix/channels/followers",
    ]);
    expect(await taskTexts()).toEqual(["one"]);
  });

  it("fails closed when the expiring token can't be refreshed", async () => {
    await connectBot();
    await db.update(schema.botAccount).set({ expiresAt: new Date(Date.now() + 1000) });
    const calls = stubHelix(() => json({}, 400));

    expect((await say("!task one")).replies).toEqual([reply(T.followCheckFailed)]);
    expect(calls.map((url) => url.pathname)).toEqual(["/oauth2/token"]);
  });

  it("fails closed with no bot account", async () => {
    const calls = stubHelix(() => followers([VIEWER_ID]));

    expect((await say("!task one")).replies).toEqual([reply(T.followCheckFailed)]);
    expect(calls).toHaveLength(0);
  });

  it("prunes week-old cache rows when it writes one", async () => {
    await connectBot();
    await db.insert(schema.followerCheck).values({
      twitchId: "9999",
      following: true,
      checkedAt: new Date(Date.now() - 8 * 24 * 3_600_000),
    });
    stubHelix(() => followers([VIEWER_ID]));

    await say("!task one");

    expect((await followRows()).map((row) => row.twitchId)).toEqual([VIEWER_ID]);
  });
});

describe("ban cleanup", () => {
  async function seed() {
    await say("!task viewer a");
    await say("!task other a", { username: "other", twitchId: "3000" });
  }

  const clearchat = (verifyBan: boolean) =>
    api().bot.ingest({
      token: BOT_TOKEN,
      kind: "clearchat",
      targetUsername: "viewer",
      targetUserId: VIEWER_ID,
      verifyBan,
    });

  it("keeps the tasks when the channel's own bot account sees the ban was lifted", async () => {
    await connectBot({ twitchId: OWNER_TWITCH_ID });
    await seed();
    const calls = stubHelix(() => json({ data: [] }));

    const result = await clearchat(true);

    expect(result.banCleanup).toEqual({ removed: 0, check: "not-banned" });
    expect(await taskTexts()).toHaveLength(2);
    expect(calls[0]?.pathname).toBe("/helix/moderation/banned");
    expect(calls[0]?.searchParams.get("user_id")).toBe(VIEWER_ID);
  });

  it("removes them when Twitch says the ban stands", async () => {
    await connectBot({ twitchId: OWNER_TWITCH_ID });
    await seed();
    stubHelix(() => json({ data: [{ user_id: VIEWER_ID, expires_at: "" }] }));

    expect((await clearchat(true)).banCleanup).toEqual({ removed: 1, check: "banned" });
    expect(await taskTexts()).toEqual(["other a"]);
  });

  it("treats a timeout Twitch still lists as not banned", async () => {
    await connectBot({ twitchId: OWNER_TWITCH_ID });
    await seed();
    stubHelix(() => json({ data: [{ user_id: VIEWER_ID, expires_at: "2030-01-01T00:00:00Z" }] }));

    expect((await clearchat(true)).banCleanup?.check).toBe("not-banned");
    expect(await taskTexts()).toHaveLength(2);
  });

  it("a separate bot account can't ask Twitch, so it removes without a call", async () => {
    await connectBot();
    await seed();
    const calls = stubHelix(() => json({ data: [] }));

    expect((await clearchat(true)).banCleanup).toEqual({ removed: 1, check: "unsupported" });
    expect(calls).toHaveLength(0);
  });

  it("removes when the check fails, as every ban did before it existed", async () => {
    await connectBot({ twitchId: OWNER_TWITCH_ID });
    await seed();
    stubHelix(() => json({}, 500));

    expect((await clearchat(true)).banCleanup).toEqual({ removed: 1, check: "unavailable" });
  });

  it("removes without the ban scope (an older connection)", async () => {
    await connectBot({ twitchId: OWNER_TWITCH_ID, scopes: ["chat:read", "chat:edit"] });
    await seed();
    const calls = stubHelix(() => json({ data: [] }));

    expect((await clearchat(true)).banCleanup?.check).toBe("unsupported");
    expect(calls).toHaveLength(0);
    expect(await taskTexts()).toEqual(["other a"]);
  });
});
