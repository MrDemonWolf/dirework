import { eq } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable, SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { DbClient } from "@dirework/db";
import { SINGLETON_ID } from "@dirework/db/schema";

type SingletonTable = SQLiteTable & { id: AnySQLiteColumn };

/** Drop `undefined` entries — drizzle skips them, so they are not part of a patch. */
export function definedValues<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** True when a patch would set at least one column (an empty SET is a SQL error). */
export function hasValues(values: Record<string, unknown>): boolean {
  return Object.keys(definedValues(values)).length > 0;
}

/**
 * Update the one row of a singleton config table (L10) — replaces the
 * repeated `.where(eq(table.id, "singleton"))` envelope across the config
 * router. An empty patch is a no-op that returns the current row.
 */
export async function updateSingleton<TTable extends SingletonTable>(
  db: DbClient,
  table: TTable,
  values: SQLiteUpdateSetSource<TTable>,
): Promise<TTable["$inferSelect"] | null> {
  const where = eq(table.id, SINGLETON_ID);
  const [row] = hasValues(values)
    ? await db.update(table).set(values).where(where).returning()
    : await db
        .select()
        .from(table as SQLiteTable)
        .where(where);
  return (row as TTable["$inferSelect"] | undefined) ?? null;
}
