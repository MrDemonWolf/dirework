import { createRequire } from "node:module";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

import { TIMER_CONFIG_DEFAULTS } from "../defaults";
import type { DbClient } from "../index";
import { provisionSingletonRows } from "../provision";
import * as schema from "../schema";
import { SINGLETON_ID } from "../schema/app";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
// decodeURIComponent because a file: URL percent-encodes spaces in the path.
const migrationsFolder = decodeURIComponent(new URL("../migrations", import.meta.url).pathname);

/** Every table `provisionSingletonRows` seeds, by SQL name. */
const SINGLETON_TABLES = [
  "timer_config",
  "timer_style",
  "task_style",
  "bot_config",
  "instance_config",
] as const;

let sqlJs: SqlJsStatic;

beforeAll(async () => {
  sqlJs = await initSqlJs({ locateFile: () => wasmPath });
});

/**
 * Real drizzle over in-memory SQLite with every migration applied — the same
 * approach as packages/auth/src/__tests__/stubs/test-db.ts. sql.js has no D1
 * `batch`, so the shim runs the statements in order and records each call's
 * size, letting a test assert provisioning stays ONE round trip.
 */
function createTestDb() {
  const db = drizzle(new sqlJs.Database(), { schema });
  migrate(db, { migrationsFolder });
  const batches: number[] = [];
  const batch = async (queries: PromiseLike<unknown>[]) => {
    batches.push(queries.length);
    const results: unknown[] = [];
    for (const query of queries) results.push(await query);
    return results;
  };
  return { db: Object.assign(db, { batch }) as unknown as DbClient, batches };
}

function idsIn(db: DbClient, table: (typeof SINGLETON_TABLES)[number]) {
  return db.all<{ id: string }>(sql`SELECT id FROM ${sql.identifier(table)} ORDER BY id`);
}

describe("provisionSingletonRows", () => {
  it("creates exactly one row per singleton table, in a single batch", async () => {
    const { db, batches } = createTestDb();

    await provisionSingletonRows(db);

    expect(batches).toEqual([SINGLETON_TABLES.length]);
    for (const table of SINGLETON_TABLES) {
      expect(await idsIn(db, table), table).toEqual([{ id: SINGLETON_ID }]);
    }
  });

  it("fills the rows from the schema defaults and mints the overlay and bot tokens", async () => {
    const { db } = createTestDb();

    await provisionSingletonRows(db);

    const [timer] = await db.select().from(schema.timerConfig);
    expect(timer?.workDuration).toBe(TIMER_CONFIG_DEFAULTS.workDuration);
    expect(timer?.longBreakInterval).toBe(TIMER_CONFIG_DEFAULTS.longBreakInterval);
    const [instance] = await db.select().from(schema.instanceConfig);
    const tokens = [instance?.overlayTimerToken, instance?.overlayTasksToken, instance?.botToken];
    for (const token of tokens) expect(token).toMatch(/\S/);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("is a no-op the second time: still one row each, and the tokens survive", async () => {
    const { db, batches } = createTestDb();
    await provisionSingletonRows(db);
    const [before] = await db.select().from(schema.instanceConfig);

    await provisionSingletonRows(db);

    expect(batches).toHaveLength(2);
    for (const table of SINGLETON_TABLES) {
      expect(await idsIn(db, table), table).toEqual([{ id: SINGLETON_ID }]);
    }
    // ON CONFLICT DO NOTHING must leave the existing row alone: re-provisioning
    // (every session create, every lazy read) must never rotate the OBS/bot URLs.
    const [after] = await db.select().from(schema.instanceConfig);
    expect(after).toEqual(before);
  });
});
