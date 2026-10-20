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
const TAG = "0018_setup_confirmations";
const SETUP_COLUMNS =
  "setup_bot_source_confirmed, setup_timer_overlay_confirmed, setup_tasks_overlay_confirmed";
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

function values(db: Database, query: string) {
  return db.exec(query)[0]?.values ?? [];
}

/** A database at the schema just before 0018, built from the real migrations. */
function createPreMigrationDatabase() {
  const db = new sqlJs.Database();
  const index = journal.entries.findIndex((entry) => entry.tag === TAG);
  expect(index).toBeGreaterThan(0);
  for (const { tag } of journal.entries.slice(0, index)) applyMigration(db, tag);
  return db;
}

describe("0018 setup confirmations", () => {
  it("a pre-existing instance row reads 0 for all three flags after the migration", () => {
    const db = createPreMigrationDatabase();
    try {
      // The row every claimed instance already has, written by the previous worker.
      db.exec(`
        INSERT INTO instance_config (id, overlay_timer_token, overlay_tasks_token, bot_token, channel_login)
        VALUES ('singleton', 'timer-token', 'tasks-token', 'bot-token', 'streamer');
      `);

      applyMigration(db, TAG);

      expect(values(db, `SELECT ${SETUP_COLUMNS} FROM instance_config`)).toEqual([[0, 0, 0]]);
      expect(
        values(db, "SELECT overlay_timer_token, bot_token, channel_login FROM instance_config"),
      ).toEqual([["timer-token", "bot-token", "streamer"]]);

      // The provisioning INSERT names no flag, so a fresh row reads 0 too, and NULL is refused.
      db.exec("DELETE FROM instance_config");
      db.exec(`
        INSERT INTO instance_config (id, overlay_timer_token, overlay_tasks_token, bot_token)
        VALUES ('singleton', 't', 'l', 'b');
      `);
      expect(values(db, `SELECT ${SETUP_COLUMNS} FROM instance_config`)).toEqual([[0, 0, 0]]);
      expect(() => db.exec("UPDATE instance_config SET setup_bot_source_confirmed = NULL")).toThrow(
        /NOT NULL/,
      );
    } finally {
      db.close();
    }
  });

  it("only adds columns — expand-only, the previous worker keeps serving while it applies", () => {
    const statements = migrationSql(TAG)
      .split("--> statement-breakpoint")
      .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);

    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^ALTER TABLE `instance_config` ADD `setup_\w+_confirmed` integer DEFAULT false NOT NULL;?$/,
      );
    }
  });
});
