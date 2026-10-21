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
const TAG = "0019_bot_mute_blocklist";
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

describe("0019 bot mute + block list", () => {
  it("an existing bot_config row reads unmuted with an empty block list", () => {
    const db = new sqlJs.Database();
    try {
      const index = journal.entries.findIndex((entry) => entry.tag === TAG);
      expect(index).toBeGreaterThan(0);
      for (const { tag } of journal.entries.slice(0, index)) applyMigration(db, tag);

      db.exec("INSERT INTO bot_config (id) VALUES ('singleton')");

      applyMigration(db, TAG);

      expect(values(db, "SELECT muted, blocked_viewers, command_aliases FROM bot_config")).toEqual([
        [0, "[]", "{}"],
      ]);
    } finally {
      db.close();
    }
  });

  it("only adds columns — expand-only, the previous worker keeps serving while it applies", () => {
    const statements = migrationSql(TAG)
      .split("--> statement-breakpoint")
      .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);

    expect(statements).toHaveLength(2);
    for (const statement of statements) {
      expect(statement).toMatch(/^ALTER TABLE `bot_config` ADD `\w+` \w+ DEFAULT .+ NOT NULL;?$/);
    }
  });
});
