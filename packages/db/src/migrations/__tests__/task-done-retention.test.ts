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
const TAG = "0015_task_done_retention";
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

describe("0015 task done retention", () => {
  it("swaps the status index for (status, completed_at) and stamps legacy done rows", () => {
    const db = new sqlJs.Database();
    try {
      const index = journal.entries.findIndex((entry) => entry.tag === TAG);
      expect(index).toBeGreaterThan(0);
      for (const { tag } of journal.entries.slice(0, index)) applyMigration(db, tag);

      db.exec(`
        INSERT INTO task (id, author_twitch_id, author_username, author_display_name, text, status, "order", created_at, completed_at) VALUES
          ('legacy', '1', 'v', 'V', 't', 'done', 1, 1000, NULL),
          ('stamped', '1', 'v', 'V', 't', 'done', 2, 1000, 5000),
          ('open', '1', 'v', 'V', 't', 'pending', 3, 1000, NULL);
      `);

      applyMigration(db, TAG);

      expect(values(db, "SELECT id, completed_at FROM task ORDER BY id")).toEqual([
        ["legacy", 1000],
        ["open", null],
        ["stamped", 5000],
      ]);
      const indexes = values(db, "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='task'")
        .map(([name]) => name);
      expect(indexes).toContain("task_status_completed_idx");
      expect(indexes).not.toContain("task_status_idx");
    } finally {
      db.close();
    }
  });
});
