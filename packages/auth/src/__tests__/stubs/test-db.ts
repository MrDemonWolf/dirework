import { createRequire } from "node:module";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs, { type SqlJsStatic } from "sql.js";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
// decodeURIComponent because a file: URL percent-encodes spaces in the path.
const migrationsFolder = decodeURIComponent(
  new URL("../../../../db/src/migrations", import.meta.url).pathname,
);

let sqlJs: SqlJsStatic | undefined;

/**
 * An in-memory SQLite database with the REAL schema (every migration applied)
 * behind real drizzle. D1's `batch` is the one API sql.js lacks; it is shimmed
 * as sequential execution, which is all the provisioning helper needs here.
 */
export async function createTestDb(): Promise<DbClient> {
  sqlJs ??= await initSqlJs({ locateFile: () => wasmPath });
  const db = drizzle(new sqlJs.Database(), { schema });
  migrate(db, { migrationsFolder });
  const batch = async (queries: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const query of queries) results.push(await query);
    return results;
  };
  return Object.assign(db, { batch }) as unknown as DbClient;
}
