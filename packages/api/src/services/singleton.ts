import { eq } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable, SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { DbClient } from "@dirework/db";
import { SINGLETON_ID } from "../config-shared";

type SingletonTable = SQLiteTable & { id: AnySQLiteColumn };

/**
 * Update the one row of a singleton config table (L10) — replaces the
 * repeated `.where(eq(table.id, "singleton"))` envelope across the config
 * router.
 */
export async function updateSingleton<TTable extends SingletonTable>(
  db: DbClient,
  table: TTable,
  values: SQLiteUpdateSetSource<TTable>,
): Promise<TTable["$inferSelect"] | null> {
  const [row] = await db
    .update(table)
    .set(values)
    .where(eq(table.id, SINGLETON_ID))
    .returning();
  return (row as TTable["$inferSelect"] | undefined) ?? null;
}
