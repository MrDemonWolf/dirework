import { z } from "zod";

import type { DbClient } from "@dirework/db";

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
