import { TRPCError } from "@trpc/server";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

/**
 * Lazily provision every singleton config row. All columns have defaults, so
 * inserting `{}` is enough; onConflictDoNothing keeps this idempotent.
 */
export async function ensureSingletons(db: DbClient) {
  await Promise.all([
    db.insert(schema.timerConfig).values({}).onConflictDoNothing(),
    db.insert(schema.timerStyle).values({}).onConflictDoNothing(),
    db.insert(schema.taskStyle).values({}).onConflictDoNothing(),
    db.insert(schema.botConfig).values({}).onConflictDoNothing(),
    db.insert(schema.instanceConfig).values({}).onConflictDoNothing(),
  ]);

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

/** Ensure the instanceConfig singleton exists and return it. */
export async function ensureInstanceConfig(db: DbClient) {
  await db.insert(schema.instanceConfig).values({}).onConflictDoNothing();
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
  await db.insert(schema.botConfig).values({}).onConflictDoNothing();
  const botConfigRow = await db.query.botConfig.findFirst();
  if (!botConfigRow) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to provision bot config",
    });
  }
  return botConfigRow;
}
