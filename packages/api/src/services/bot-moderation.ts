import { and, eq, sql } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { SINGLETON_ID } from "@dirework/db/schema";

import { MAX_BLOCKED_VIEWERS } from "../chat-commands";
import { removeTasksByUsernameStmt } from "./task-service";

// Bot moderation state (mute switch + viewer block list) on the bot_config
// singleton. Shared by the chat commands (!mute/!block) and the dashboard
// (config router), so both apply exactly the same writes (audit M1).
//
// Every write is a guarded UPDATE: it changes the row only when the state
// actually differs, never a read-modify-write, so two mods acting at once can't
// lose an entry and a repeated command costs no write. Callers pass logins that
// went through normalizeTwitchLogin (lowercase, no "@").

const blocked = schema.botConfig.blockedViewers;

/** Set the mute switch. Resolves true when the row changed, false when it was already in that state. */
export async function setBotMuted(db: DbClient, muted: boolean): Promise<boolean> {
  const rows = await db
    .update(schema.botConfig)
    .set({ muted })
    .where(and(eq(schema.botConfig.id, SINGLETON_ID), eq(schema.botConfig.muted, !muted)))
    .returning({ id: schema.botConfig.id });
  return rows.length > 0;
}

/**
 * Add a login to the block list and delete every task that viewer added, in
 * ONE db.batch (atomic on D1). The append is guarded: it is a no-op when the
 * login is already listed or the list holds MAX_BLOCKED_VIEWERS names. The task
 * DELETE runs either way, so re-blocking also sweeps tasks added since.
 */
export async function blockViewer(db: DbClient, login: string): Promise<{ added: boolean }> {
  const [appended] = await db.batch([
    db
      .update(schema.botConfig)
      .set({ blockedViewers: sql`json_insert(${blocked}, '$[#]', ${login})` })
      .where(
        and(
          eq(schema.botConfig.id, SINGLETON_ID),
          sql`not exists (select 1 from json_each(${blocked}) where value = ${login})`,
          sql`json_array_length(${blocked}) < ${MAX_BLOCKED_VIEWERS}`,
        ),
      )
      .returning({ id: schema.botConfig.id }),
    removeTasksByUsernameStmt(db, login),
  ]);
  return { added: appended.length > 0 };
}

/** Remove a login from the block list. Their deleted tasks do not come back. */
export async function unblockViewer(db: DbClient, login: string): Promise<{ removed: boolean }> {
  const rows = await db
    .update(schema.botConfig)
    .set({
      blockedViewers: sql`(select json_group_array(value) from json_each(${blocked}) where value != ${login})`,
    })
    .where(
      and(
        eq(schema.botConfig.id, SINGLETON_ID),
        sql`exists (select 1 from json_each(${blocked}) where value = ${login})`,
      ),
    )
    .returning({ id: schema.botConfig.id });
  return { removed: rows.length > 0 };
}
