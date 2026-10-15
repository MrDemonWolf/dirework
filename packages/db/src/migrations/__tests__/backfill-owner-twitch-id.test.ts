import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../0012_backfill_owner_twitch_id.sql"),
  "utf8",
);
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
let sqlJs: SqlJsStatic;

beforeAll(async () => {
  sqlJs = await initSqlJs({ locateFile: () => wasmPath });
});

function twitchIds(seed: string): Record<string, unknown> {
  const db = new sqlJs.Database();
  try {
    db.exec(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY,
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
      ${seed}
    `);
    // Applying twice proves the migration is idempotent.
    db.exec(migration);
    db.exec(migration);
    const [result] = db.exec("SELECT id, twitch_id FROM user ORDER BY id");
    return Object.fromEntries(result?.values.map(([id, twitchId]) => [id, twitchId]) ?? []);
  } finally {
    db.close();
  }
}

describe("0012 backfill owner twitch id", () => {
  it("fills a NULL owner twitch_id from the linked Twitch account", () => {
    expect(
      twitchIds(`
        INSERT INTO user (id, twitch_id, is_owner) VALUES ('owner', NULL, 1);
        INSERT INTO account (id, account_id, provider_id, user_id, created_at) VALUES
          ('blank', '', 'twitch', 'owner', 10),
          ('linked', '123', 'twitch', 'owner', 20);
      `),
    ).toEqual({ owner: "123" });
  });

  it("never overwrites an existing ID or touches non-owners and dev owners", () => {
    expect(
      twitchIds(`
        INSERT INTO user (id, twitch_id, is_owner) VALUES
          ('owner', '999', 1),
          ('viewer', NULL, 0),
          ('dev', NULL, 1);
        INSERT INTO account (id, account_id, provider_id, user_id, created_at) VALUES
          ('a1', '123', 'twitch', 'owner', 10),
          ('a2', '456', 'twitch', 'viewer', 10);
      `),
    ).toEqual({ dev: null, owner: "999", viewer: null });
  });
});
