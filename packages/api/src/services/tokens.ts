import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { ensureInstanceConfig } from "./provision";
import { updateSingleton } from "./singleton";

/**
 * Bounded public token input (L3) — every public token-gated procedure uses
 * this instead of an unbounded z.string().
 */
export const tokenInput = z.string().min(8).max(128);

/**
 * Constant-time string comparison (L2). Workers-safe: plain XOR-accumulate
 * loop over char codes, no node:crypto dependency. The length check is an
 * acceptable early exit — token length is not secret.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Single overlay-token gate (L8) shared by overlay/timer/task public
 * procedures.
 */
export async function verifyOverlayToken(
  db: DbClient,
  kind: "timer" | "tasks",
  token: string,
): Promise<boolean> {
  const instance = await db.query.instanceConfig.findFirst({
    columns: { overlayTimerToken: true, overlayTasksToken: true },
  });
  if (!instance) return false;
  const expected = kind === "timer" ? instance.overlayTimerToken : instance.overlayTasksToken;
  return constantTimeEqual(expected, token);
}

/** Gate for the browser bot page — validates against instanceConfig.botToken. */
export async function verifyBotToken(db: DbClient, token: string): Promise<boolean> {
  const instance = await db.query.instanceConfig.findFirst({
    columns: { botToken: true },
  });
  if (!instance) return false;
  return constantTimeEqual(instance.botToken, token);
}

/**
 * Overlay-gate envelope: run `load` only when the token matches; otherwise
 * resolve null (overlays render blank instead of erroring in OBS).
 */
export async function withOverlayToken<T>(
  db: DbClient,
  kind: "timer" | "tasks",
  token: string,
  load: () => Promise<T>,
): Promise<T | null> {
  if (!(await verifyOverlayToken(db, kind, token))) return null;
  return load();
}

/** Bot-gate envelope: throw UNAUTHORIZED unless the bot-page token matches. */
export async function requireBotToken(db: DbClient, token: string): Promise<void> {
  if (!(await verifyBotToken(db, token))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid bot token" });
  }
}

/** instanceConfig columns that hold a rotatable bearer token. */
export type InstanceTokenField = "overlayTimerToken" | "overlayTasksToken" | "botToken";

/**
 * Rotate one instance token (invalidates any previously copied URL). Provisions
 * the row first and fails loudly if the write did not land, so a caller is never
 * handed a token that was not saved.
 */
export async function rotateInstanceToken(
  db: DbClient,
  field: InstanceTokenField,
): Promise<string> {
  await ensureInstanceConfig(db);
  const token = crypto.randomUUID();
  const updated = await updateSingleton(db, schema.instanceConfig, { [field]: token });
  if (updated?.[field] !== token) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to rotate token" });
  }
  return token;
}
