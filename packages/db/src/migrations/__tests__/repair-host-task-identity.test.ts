import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../0011_repair_host_task_identity.sql", import.meta.url),
  "utf8",
);
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
let sqlJs: SqlJsStatic;

beforeAll(async () => {
  sqlJs = await initSqlJs({ locateFile: () => wasmPath });
});

function createDatabase() {
  const db = new sqlJs.Database();
  db.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      twitch_id TEXT,
      is_owner INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE task (
      id TEXT PRIMARY KEY,
      author_twitch_id TEXT NOT NULL,
      author_username TEXT NOT NULL,
      author_display_name TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX task_one_active_per_author_idx
      ON task (author_twitch_id)
      WHERE status = 'active';
  `);
  return db;
}

function applyMigration(db: Database) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

function rows<T extends Record<string, unknown>>(db: Database, query: string): T[] {
  const [result] = db.exec(query);
  if (!result) return [];

  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
  ) as T[];
}

function row<T extends Record<string, unknown>>(db: Database, query: string): T | undefined {
  return rows<T>(db, query)[0];
}

describe("0011 repair host task identity", () => {
  it("merges known owner aliases without claiming a same-name viewer", () => {
    const db = createDatabase();

    try {
      db.exec(`
        INSERT INTO user (id, name, twitch_id, is_owner)
        VALUES ('internal-owner', 'NewWolf', NULL, 1);

        INSERT INTO account (id, account_id, provider_id, user_id, created_at) VALUES
          ('empty-account', '', 'twitch', 'internal-owner', 10),
          ('linked-twitch', '123', 'twitch', 'internal-owner', 20);

        INSERT INTO task (
          id, author_twitch_id, author_username, author_display_name,
          status, priority, created_at
        ) VALUES
          ('legacy-blank', '', 'NewWolf', 'NewWolf', 'active', 1, 100),
          ('legacy-internal', 'internal-owner', 'OldWolf', 'OldWolf', 'active', 1, 150),
          ('canonical-active', '123', 'OldWolf', 'OldWolf', 'active', 0, 200),
          ('canonical-pending', '123', 'NewWolf', 'NewWolf', 'pending', 0, 250),
          ('same-name-viewer', 'viewer-9', 'NewWolf', 'NewWolf', 'active', 1, 300);
      `);

      applyMigration(db);

      const owner = row<{ twitchId: string }>(
        db,
        "SELECT twitch_id AS twitchId FROM user WHERE id = 'internal-owner'",
      );
      expect(owner?.twitchId).toBe("123");

      const hostTasks = rows<{
        authorTwitchId: string;
        id: string;
        priority: number;
        status: string;
      }>(
        db,
        `SELECT id, author_twitch_id AS authorTwitchId, priority, status
         FROM task
         WHERE id <> 'same-name-viewer'
         ORDER BY created_at`,
      );
      expect(hostTasks).toHaveLength(4);
      expect(hostTasks.every((task) => task.authorTwitchId === "123")).toBe(true);
      expect(hostTasks.every((task) => task.priority === 0)).toBe(true);
      expect(hostTasks.filter((task) => task.status === "active").map((task) => task.id)).toEqual([
        "legacy-blank",
      ]);

      const viewer = row<{ authorTwitchId: string; priority: number; status: string }>(
        db,
        `SELECT author_twitch_id AS authorTwitchId, priority, status
         FROM task
         WHERE id = 'same-name-viewer'`,
      );
      expect(viewer).toEqual({ authorTwitchId: "viewer-9", priority: 1, status: "active" });
    } finally {
      db.close();
    }
  });

  it("uses the internal user ID for a dev owner without a Twitch account", () => {
    const db = createDatabase();

    try {
      db.exec(`
        INSERT INTO user (id, name, twitch_id, is_owner)
        VALUES ('dev-owner', 'DevUser', NULL, 1);

        INSERT INTO task (
          id, author_twitch_id, author_username, author_display_name,
          status, priority, created_at
        ) VALUES
          ('legacy-blank', '', 'DevUser', 'DevUser', 'active', 1, 100),
          ('internal-active', 'dev-owner', 'DevUser', 'DevUser', 'active', 0, 200),
          ('internal-pending', 'dev-owner', 'DevUser', 'DevUser', 'pending', 0, 250);
      `);

      applyMigration(db);

      const tasks = rows<{
        authorTwitchId: string;
        id: string;
        priority: number;
        status: string;
      }>(
        db,
        `SELECT id, author_twitch_id AS authorTwitchId, priority, status
         FROM task
         ORDER BY created_at`,
      );
      expect(tasks.every((task) => task.authorTwitchId === "dev-owner")).toBe(true);
      expect(tasks.every((task) => task.priority === 0)).toBe(true);
      expect(tasks.filter((task) => task.status === "active").map((task) => task.id)).toEqual([
        "legacy-blank",
      ]);
    } finally {
      db.close();
    }
  });
});
