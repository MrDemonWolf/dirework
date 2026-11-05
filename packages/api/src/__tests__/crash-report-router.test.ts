import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import type { Context } from "../context";
import { CRASH_SURFACES, crashLabel } from "../crash-report";
import { appRouter } from "../routers/index";
import { createSqliteDb } from "./helpers/sqlite-db";

/**
 * crash.report through the REAL appRouter on real SQLite: a stuck overlay or bot page reports
 * its surface and error NAME with its own token; the api logs one `client.crash` line through
 * the context hook and writes nothing.
 */

const TIMER_TOKEN = "timer-token-0123456789abcdef";
const TASKS_TOKEN = "tasks-token-0123456789abcdef";
const BOT_TOKEN = "bot-token-0123456789abcdef";

let db: DbClient;
let recordClientCrash: ReturnType<typeof vi.fn<(label: string) => void>>;

beforeEach(async () => {
  ({ db } = await createSqliteDb());
  await provisionSingletonRows(db);
  await db.update(schema.instanceConfig).set({
    overlayTimerToken: TIMER_TOKEN,
    overlayTasksToken: TASKS_TOKEN,
    botToken: BOT_TOKEN,
  });
  recordClientCrash = vi.fn<(label: string) => void>();
});

const anon = () =>
  appRouter.createCaller({ session: null, db, recordClientCrash } as unknown as Context);

const snapshot = async () => JSON.stringify(await db.query.instanceConfig.findFirst());

describe("crash.report", () => {
  it.each([
    ["overlay_timer", TIMER_TOKEN],
    ["overlay_tasks", TASKS_TOKEN],
    ["bot_widget", BOT_TOKEN],
    ["bot_dock", BOT_TOKEN],
  ] as const)("logs one client.crash line for %s with its own token", async (surface, token) => {
    const before = await snapshot();
    await expect(anon().crash.report({ token, surface, name: "TypeError" })).resolves.toBeNull();
    expect(recordClientCrash).toHaveBeenCalledTimes(1);
    expect(recordClientCrash).toHaveBeenCalledWith(`${surface}:TypeError`);
    // No D1 write: the token read is the only statement.
    expect(await snapshot()).toBe(before);
  });

  it("logs nothing for a wrong token, or another surface's token, and answers the same", async () => {
    await expect(
      anon().crash.report({
        token: "wrong-token-0123456789",
        surface: "bot_widget",
        name: "Error",
      }),
    ).resolves.toBeNull();
    await expect(
      anon().crash.report({ token: BOT_TOKEN, surface: "overlay_timer", name: "Error" }),
    ).resolves.toBeNull();
    await expect(
      anon().crash.report({ token: TIMER_TOKEN, surface: "overlay_tasks", name: "Error" }),
    ).resolves.toBeNull();
    expect(recordClientCrash).not.toHaveBeenCalled();
  });

  it.each([
    "Cannot read properties of undefined",
    "https://example.test/?code=abc",
    "x".repeat(27),
    "",
    "Error\nat foo",
  ])("rejects a message-like name %j before the token check", async (name) => {
    await expect(
      anon().crash.report({ token: TIMER_TOKEN, surface: "overlay_timer", name }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recordClientCrash).not.toHaveBeenCalled();
  });

  it("rejects a surface outside the closed list and any extra field", async () => {
    await expect(
      anon().crash.report({
        token: TIMER_TOKEN,
        surface: "dashboard" as "overlay_timer",
        name: "Error",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      anon().crash.report({
        token: TIMER_TOKEN,
        surface: "overlay_timer",
        name: "Error",
        message: "task text",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recordClientCrash).not.toHaveBeenCalled();
  });

  it("keeps every surface:name label inside telemetry's 40-character label pattern", () => {
    for (const surface of CRASH_SURFACES) {
      expect(crashLabel(surface, "x".repeat(26))).toMatch(/^[a-z0-9_.:-]{1,40}$/i);
    }
  });
});
