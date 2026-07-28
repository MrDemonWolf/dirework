import { TRPCError } from "@trpc/server";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";

/**
 * Lazily provision every singleton config row and return the config rows.
 * The insert logic is the shared implementation in @dirework/db/provision
 * (also used by the auth session-create hook, so the two cannot drift).
 */
export async function ensureSingletons(db: DbClient) {
  await provisionSingletonRows(db);

  const [timerConfigRow, timerStyleRow, taskStyleRow, botConfigRow] = await Promise.all([
    db.query.timerConfig.findFirst(),
    db.query.timerStyle.findFirst(),
    db.query.taskStyle.findFirst(),
    db.query.botConfig.findFirst(),
  ]);

  if (!timerConfigRow || !timerStyleRow || !taskStyleRow || !botConfigRow) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to provision config" });
  }
  return {
    timerConfig: timerConfigRow,
    timerStyle: timerStyleRow,
    taskStyle: taskStyleRow,
    botConfig: botConfigRow,
  };
}

/**
 * Ensure the instanceConfig singleton exists and return it. Provisioning goes
 * through the shared `provisionSingletonRows` — these used to run their own
 * `insert().values({})` (no explicit id, relying on a column default), a second
 * provisioning path that could drift from the shared one.
 */
export async function ensureInstanceConfig(db: DbClient) {
  await provisionSingletonRows(db);
  const instance = await db.query.instanceConfig.findFirst();
  if (!instance) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to provision instance config",
    });
  }
  return instance;
}

/** Ensure the botConfig singleton exists and return it. */
export async function ensureBotConfig(db: DbClient) {
  await provisionSingletonRows(db);
  const botConfigRow = await db.query.botConfig.findFirst();
  if (!botConfigRow) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to provision bot config",
    });
  }
  return botConfigRow;
}
