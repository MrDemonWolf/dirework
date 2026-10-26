import { beforeEach, describe, expect, it } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import { BOT_LEASE_TTL_MS, BOT_STANDBY_MESSAGE } from "../bot-lease";
import type { Context } from "../context";
import { appRouter } from "../routers/index";
import { createSqliteDb } from "./helpers/sqlite-db";

/**
 * The one-bot-page lease through the REAL appRouter on real SQLite: bot.heartbeat and
 * bot.release, bot.ingest refusing a page another one took over from (from the token read it
 * already does), and user.me reporting the last check-in for the dashboard's chip.
 */

const BOT_TOKEN = "bot-token-0123456789abcdef";
const PAGE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAGE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER = {
  id: "owner",
  name: "streamer",
  email: "owner@example.test",
  twitchId: "1000",
  displayName: "Streamer",
  isOwner: true,
};

let db: DbClient;

beforeEach(async () => {
  ({ db } = await createSqliteDb());
  await provisionSingletonRows(db);
  await db.update(schema.instanceConfig).set({ botToken: BOT_TOKEN, channelLogin: "streamer" });
  await db.insert(schema.user).values(OWNER);
});

const anon = () => appRouter.createCaller({ session: null, db } as unknown as Context);
const owner = () =>
  appRouter.createCaller({
    session: { user: { ...OWNER } },
    db,
  } as unknown as Context);

function addTask(instanceId?: string) {
  return anon().bot.ingest({
    token: BOT_TOKEN,
    instanceId,
    kind: "message",
    username: "viewer",
    displayName: "Viewer",
    twitchId: "2000",
    message: "!task write the intro",
    isMod: false,
  });
}

const taskCount = async () => (await db.query.task.findMany()).length;

describe("bot.heartbeat", () => {
  it("refuses a wrong bot token and takes no lease", async () => {
    await expect(
      anon().bot.heartbeat({ token: "wrong-token-0123456789", instanceId: PAGE_A }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect((await db.query.instanceConfig.findFirst())?.botLeaseInstanceId).toBeNull();
  });

  it("gives the lease to the first page, standby to the second, and the chat on takeover", async () => {
    await expect(anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A })).resolves.toEqual({
      holder: true,
    });
    await expect(anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B })).resolves.toEqual({
      holder: false,
    });
    await expect(anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A })).resolves.toEqual({
      holder: true,
    });

    await expect(
      anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B, takeover: true }),
    ).resolves.toEqual({ holder: true });
    await expect(anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A })).resolves.toEqual({
      holder: false,
    });
  });

  it("answers a standby page's check-in without touching the row", async () => {
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A });
    const before = await db.query.instanceConfig.findFirst();

    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B });

    expect(await db.query.instanceConfig.findFirst()).toEqual(before);
  });

  it("rejects an instance id that isn't a UUID-shaped token", async () => {
    await expect(
      anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: "not an id; drop" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("bot.release", () => {
  it("frees the holder's lease and ignores a page that isn't the holder", async () => {
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A });

    await expect(anon().bot.release({ token: BOT_TOKEN, instanceId: PAGE_B })).resolves.toEqual({
      released: false,
    });
    await expect(anon().bot.release({ token: BOT_TOKEN, instanceId: PAGE_A })).resolves.toEqual({
      released: true,
    });
    await expect(anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B })).resolves.toEqual({
      holder: true,
    });
  });

  it("needs the bot token", async () => {
    await expect(
      anon().bot.release({ token: "wrong-token-0123456789", instanceId: PAGE_A }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("bot.ingest and the lease", () => {
  it("refuses a page another one took over from, before running anything", async () => {
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A });
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B, takeover: true });

    await expect(addTask(PAGE_A)).rejects.toMatchObject({
      code: "CONFLICT",
      message: BOT_STANDBY_MESSAGE,
    });
    expect(await taskCount()).toBe(0);

    await addTask(PAGE_B);
    expect(await taskCount()).toBe(1);
  });

  it("refuses a clearchat relay from a page that lost the lease", async () => {
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_B });
    await addTask(PAGE_B);

    await expect(
      anon().bot.ingest({
        token: BOT_TOKEN,
        instanceId: PAGE_A,
        kind: "clearchat",
        targetUsername: "viewer",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await taskCount()).toBe(1);
  });

  it("relays from a page loaded before the lease existed (no instance id)", async () => {
    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A });
    await addTask();
    expect(await taskCount()).toBe(1);
  });

  it("relays when the lease is free or expired", async () => {
    await addTask(PAGE_A);
    expect(await taskCount()).toBe(1);

    await db.update(schema.instanceConfig).set({
      botLeaseInstanceId: PAGE_B,
      botLeaseSeenAt: new Date(Date.now() - BOT_LEASE_TTL_MS - 1000),
    });
    const before = await db.query.instanceConfig.findFirst();
    await addTask(PAGE_A);
    // Relaying never touches the lease: only heartbeats write it.
    expect(await db.query.instanceConfig.findFirst()).toEqual(before);
  });
});

describe("user.me bot presence", () => {
  it("is null until a bot page checks in, then the check-in's age", async () => {
    expect((await owner().user.me())?.botPageSeenMsAgo).toBeNull();

    await anon().bot.heartbeat({ token: BOT_TOKEN, instanceId: PAGE_A });
    const age = (await owner().user.me())?.botPageSeenMsAgo;
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(5000);

    await anon().bot.release({ token: BOT_TOKEN, instanceId: PAGE_A });
    expect((await owner().user.me())?.botPageSeenMsAgo).toBeNull();
  });

  it("reports an old check-in as its age, never as a timestamp", async () => {
    await db
      .update(schema.instanceConfig)
      .set({ botLeaseInstanceId: PAGE_A, botLeaseSeenAt: new Date(Date.now() - 10 * 60_000) });
    expect((await owner().user.me())?.botPageSeenMsAgo).toBeGreaterThanOrEqual(10 * 60_000);
  });
});
