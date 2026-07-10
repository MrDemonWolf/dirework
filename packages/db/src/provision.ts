import type { DbClient } from "./index";
import * as schema from "./schema";
import { SINGLETON_ID } from "./schema/app";

/**
 * Idempotently create every singleton config row — the ONE shared
 * implementation called by both the better-auth session-create hook
 * (packages/auth) and the API's lazy provisioning (packages/api). Explicit
 * id is required: SQLite rejects an upsert clause on `DEFAULT VALUES`, and
 * D1 `batch` keeps the five inserts atomic in one round trip.
 */
export async function provisionSingletonRows(db: DbClient): Promise<void> {
  await db.batch([
    db.insert(schema.timerConfig).values({ id: SINGLETON_ID }).onConflictDoNothing(),
    db.insert(schema.timerStyle).values({ id: SINGLETON_ID }).onConflictDoNothing(),
    db.insert(schema.taskStyle).values({ id: SINGLETON_ID }).onConflictDoNothing(),
    db.insert(schema.botConfig).values({ id: SINGLETON_ID }).onConflictDoNothing(),
    db.insert(schema.instanceConfig).values({ id: SINGLETON_ID }).onConflictDoNothing(),
  ]);
}
