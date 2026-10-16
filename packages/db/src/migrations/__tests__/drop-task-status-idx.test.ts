import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(readFileSync(resolve(migrationsDir, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
let sqlJs: SqlJsStatic;

beforeAll(async () => {
  sqlJs = await initSqlJs({ locateFile: () => wasmPath });
});

function applyMigration(db: Database, tag: string) {
  const sql = readFileSync(resolve(migrationsDir, `${tag}.sql`), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

function values(db: Database, query: string) {
  return db.exec(query)[0]?.values ?? [];
}

describe("0017 drop task_status_idx", () => {
  it("drops the superseded index and status reads still use an index, not a scan", () => {
    const db = new sqlJs.Database();
    try {
      for (const { tag } of journal.entries) applyMigration(db, tag);

      const indexes = values(
        db,
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='task'",
      ).map(([name]) => name);
      expect(indexes).not.toContain("task_status_idx");
      expect(indexes).toContain("task_status_completed_idx");

      // The open-task read used to be able to plan against task_status_idx.
      const plan = values(
        db,
        "EXPLAIN QUERY PLAN SELECT id FROM task WHERE status IN ('pending', 'active')",
      )
        .map((row) => String(row[3]))
        .join("\n");
      expect(plan).toContain("task_status_completed_idx");
      expect(plan).not.toMatch(/SCAN task\b(?! USING)/);
    } finally {
      db.close();
    }
  });
});
