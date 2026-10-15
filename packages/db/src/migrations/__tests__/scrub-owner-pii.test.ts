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
const SCRUB_TAG = "0014_scrub_owner_pii";
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

/** A database at the schema just before the scrub, built from the real migrations. */
function createPreScrubDatabase() {
  const db = new sqlJs.Database();
  const scrubIndex = journal.entries.findIndex((entry) => entry.tag === SCRUB_TAG);
  expect(scrubIndex).toBeGreaterThan(0);
  for (const { tag } of journal.entries.slice(0, scrubIndex)) applyMigration(db, tag);
  return db;
}

function rows<T extends Record<string, unknown>>(db: Database, query: string): T[] {
  const [result] = db.exec(query);
  if (!result) return [];

  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
  ) as T[];
}

describe("0012 scrub owner PII", () => {
  it("drops owner OAuth tokens, real emails and session IP/UA but keeps bot credentials", () => {
    const db = createPreScrubDatabase();

    try {
      db.exec(`
        INSERT INTO user (id, name, email, email_verified, twitch_id, is_owner) VALUES
          ('owner', 'Streamer', 'streamer@example.test', 1, '111', 1),
          ('legacy', 'Legacy', 'legacy@example.test', 1, NULL, 0),
          ('dev', 'Dev', 'dev@example.test', 1, NULL, 0);

        INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, created_at, updated_at) VALUES
          ('owner-twitch', '111', 'twitch', 'owner', 'at-1', 'rt-1', 'idt-1', 10, 10),
          ('legacy-blank', '', 'twitch', 'legacy', NULL, NULL, NULL, 10, 10),
          ('legacy-twitch', '222', 'twitch', 'legacy', 'at-2', 'rt-2', NULL, 20, 20),
          ('dev-other', 'dev', 'dev-login', 'dev', 'keep', NULL, NULL, 10, 10);

        INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) VALUES
          ('s1', 9999999999999, 'tok-1', 10, 10, '203.0.113.7', 'Mozilla/5.0', 'owner');

        INSERT INTO bot_account (twitch_id, username, display_name, access_token, refresh_token, expires_at)
        VALUES ('999', 'bot', 'Bot', 'bot-at', 'bot-rt', 0);
      `);

      applyMigration(db, SCRUB_TAG);

      expect(
        rows(db, "SELECT id, email, email_verified AS emailVerified FROM user ORDER BY id"),
      ).toEqual([
        { id: "dev", email: "dev@example.test", emailVerified: 1 },
        { id: "legacy", email: "222@users.twitch.invalid", emailVerified: 0 },
        { id: "owner", email: "111@users.twitch.invalid", emailVerified: 0 },
      ]);
      expect(
        rows(
          db,
          `SELECT id, access_token AS accessToken, refresh_token AS refreshToken, id_token AS idToken
           FROM account ORDER BY id`,
        ),
      ).toEqual([
        { id: "dev-other", accessToken: "keep", refreshToken: null, idToken: null },
        { id: "legacy-blank", accessToken: null, refreshToken: null, idToken: null },
        { id: "legacy-twitch", accessToken: null, refreshToken: null, idToken: null },
        { id: "owner-twitch", accessToken: null, refreshToken: null, idToken: null },
      ]);
      expect(
        rows(db, "SELECT token, ip_address AS ipAddress, user_agent AS userAgent FROM session"),
      ).toEqual([{ token: "tok-1", ipAddress: null, userAgent: null }]);
      expect(
        rows(db, "SELECT access_token AS accessToken, refresh_token AS refreshToken FROM bot_account"),
      ).toEqual([{ accessToken: "bot-at", refreshToken: "bot-rt" }]);
    } finally {
      db.close();
    }
  });
});
