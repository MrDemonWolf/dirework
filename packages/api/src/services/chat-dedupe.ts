import { lt } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

/** How long a handled IRC message id is remembered. */
export const CHAT_DEDUPE_WINDOW_MS = 5 * 60_000;

/**
 * Claim an IRC message id for processing. Every open bot page receives the
 * same PRIVMSG, so only the first relay may run the command (and reply); the
 * rest get `false`. Pruning expired ids rides in the same atomic batch, which
 * keeps the table bounded to one window of commands.
 */
export async function claimChatMessage(
  db: DbClient,
  messageId: string,
  now: number = Date.now(),
): Promise<boolean> {
  const [, claimed] = await db.batch([
    db
      .delete(schema.processedChatMessage)
      .where(lt(schema.processedChatMessage.processedAt, new Date(now - CHAT_DEDUPE_WINDOW_MS))),
    db
      .insert(schema.processedChatMessage)
      .values({ id: messageId, processedAt: new Date(now) })
      .onConflictDoNothing()
      .returning({ id: schema.processedChatMessage.id }),
  ]);
  return claimed.length > 0;
}
