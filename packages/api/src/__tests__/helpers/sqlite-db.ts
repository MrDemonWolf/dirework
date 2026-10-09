import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

/**
 * A real SQLite engine (sql.js) with every D1 migration applied, wrapped in
 * drizzle so the services run their actual SQL — predicates, subqueries, and
 * the partial unique index included. sql-js has no `db.batch`, so one is
 * emulated as a transaction, which is the atomicity D1's batch provides.
 */

const migrationsDir = fileURLToPath(
  new URL("../../../../db/src/migrations/", import.meta.url).href,
);
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");

let sqlJs: Promise<SqlJsStatic> | undefined;

function applyMigrations(sqlite: Database) {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const source = readFileSync(`${migrationsDir}${file}`, "utf8");
    for (const statement of source.split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

interface PreparedQuery {
  get: (placeholders?: unknown) => unknown;
  all: (placeholders?: unknown) => unknown;
  customResultMapper?: unknown;
}

/**
 * drizzle's sql-js session drops the relational-query result mapper, so
 * `db.query.*` would return raw snake_case rows (and `{}` for a missing
 * findFirst). Forward the mapper, and route "first" through `all`, whose
 * mapper already returns the first row or undefined — which is what D1 does.
 */
function patchRelationalQueries(orm: object) {
  const { session } = orm as { session: { prepareQuery: (...args: unknown[]) => unknown } };
  const prepareQuery = session.prepareQuery.bind(session);
  session.prepareQuery = (query, fields, executeMethod, inArrayMode, customResultMapper) => {
    const prepared = prepareQuery(query, fields, executeMethod, inArrayMode) as PreparedQuery;
    if (customResultMapper) {
      prepared.customResultMapper = customResultMapper;
      if (executeMethod === "get") prepared.get = (placeholders) => prepared.all(placeholders);
    }
    return prepared;
  };
}

export async function createSqliteDb() {
  sqlJs ??= initSqlJs({ locateFile: () => wasmPath });
  const sqlite = new (await sqlJs).Database();
  applyMigrations(sqlite);

  const orm = drizzle(sqlite, { schema });
  patchRelationalQueries(orm);

  const batch = async (statements: PromiseLike<unknown>[]) => {
    sqlite.exec("BEGIN");
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement);
      sqlite.exec("COMMIT");
      return results;
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  };
  const db = Object.assign(orm, { batch }) as unknown as DbClient;

  return { db, sqlite };
}
