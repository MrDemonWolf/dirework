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
const TAG = "0021_bot_page_lease";
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
let sqlJs: SqlJsStatic;

beforeAll(async () => {
  sqlJs = await initSqlJs({ locateFile: () => wasmPath });
});

function migrationSql(tag: string) {
  return readFileSync(resolve(migrationsDir, `${tag}.sql`), "utf8");
}

function applyMigration(db: Database, tag: string) {
  for (const statement of migrationSql(tag).split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

describe("0021 bot page lease", () => {
  it("an existing instance_config row starts with nobody holding the lease", () => {
    const db = new sqlJs.Database();
    try {
      const index = journal.entries.findIndex((entry) => entry.tag === TAG);
      expect(index).toBeGreaterThan(0);
      for (const { tag } of journal.entries.slice(0, index)) applyMigration(db, tag);

      db.exec(
        "INSERT INTO instance_config (id, overlay_timer_token, overlay_tasks_token, bot_token) VALUES ('singleton', 't', 'l', 'b')",
      );

      applyMigration(db, TAG);

      expect(
        db.exec("SELECT bot_lease_instance_id, bot_lease_seen_at FROM instance_config")[0]?.values,
      ).toEqual([[null, null]]);
    } finally {
      db.close();
    }
  });

  it("only adds nullable columns — expand-only, the previous worker keeps serving while it applies", () => {
    const statements = migrationSql(TAG)
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements).toEqual([
      "ALTER TABLE `instance_config` ADD `bot_lease_instance_id` text;",
      "ALTER TABLE `instance_config` ADD `bot_lease_seen_at` integer;",
    ]);
  });
});
