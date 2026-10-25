// Local-only export/restore drill with synthetic data; never accepts a remote target.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { compatibilityDate, repoRoot } from "./wrangler";

const workDir = mkdtempSync(path.join(tmpdir(), "dirework-recovery-"));
const wrangler = path.join(repoRoot, "packages/e2e/node_modules/.bin/wrangler");
const database = "dirework-recovery";

function run(state: "source" | "restored", args: string[]): string {
  return execFileSync(
    wrangler,
    ["d1", ...args, "--local", "--config", path.join(workDir, state, "wrangler.json")],
    { cwd: workDir, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
}

function query(state: "source" | "restored", command: string): Record<string, unknown>[] {
  const result = JSON.parse(run(state, ["execute", database, "--command", command, "--json"])) as {
    success: boolean;
    results: Record<string, unknown>[];
  }[];
  assert.ok(result.length > 0 && result.every((entry) => entry.success));
  return result.flatMap((entry) => entry.results);
}

try {
  for (const state of ["source", "restored"]) {
    const directory = path.join(workDir, state);
    mkdirSync(directory);
    writeFileSync(
      path.join(directory, "wrangler.json"),
      JSON.stringify({
        name: database,
        compatibility_date: compatibilityDate(),
        d1_databases: [
          {
            binding: "DB",
            database_name: database,
            database_id: "local-recovery-only",
            migrations_dir: path.join(repoRoot, "packages/db/src/migrations"),
          },
        ],
      }),
    );
  }
  run("source", ["migrations", "apply", database]);
  const fixturePath = path.join(workDir, "fixture.sql");
  writeFileSync(
    fixturePath,
    `
    INSERT INTO user (id, name, email, twitch_id, is_owner)
      VALUES ('owner', 'Recovery owner', '123@users.twitch.invalid', '123', 1);
    INSERT INTO account (id, account_id, provider_id, user_id)
      VALUES ('account', '123', 'twitch', 'owner');
    INSERT INTO session (id, token, expires_at, user_id)
      VALUES ('session', 'synthetic-session', 1900000000000, 'owner');
    INSERT INTO instance_config (overlay_timer_token, overlay_tasks_token, bot_token, setup_bot_source_confirmed)
      VALUES ('synthetic-timer', 'synthetic-tasks', 'synthetic-bot', 1);
    INSERT INTO bot_account (twitch_id, username, display_name, access_token, refresh_token, expires_at)
      VALUES ('456', 'recoverybot', 'Recovery Bot', 'synthetic-access', 'synthetic-refresh', 1900000000000);
    INSERT INTO timer_config (work_duration) VALUES (1200000);
    INSERT INTO timer_state (status, paused_with_remaining, paused_from_status)
      VALUES ('paused', 42000, 'work');
    INSERT INTO timer_style (bg_color) VALUES ('#091533');
    INSERT INTO task_style (display_show_done) VALUES (0);
    INSERT INTO bot_config (command_aliases) VALUES ('{"t":"task"}');
    INSERT INTO task (id, author_twitch_id, author_username, author_display_name, text, status, "order", created_at, completed_at)
      VALUES ('active', '123', 'owner', 'Owner', 'Check quotes: '' and Unicode 🐺', 'active', 0, 1800000000000, NULL),
             ('done', '456', 'viewer', 'Viewer', 'Finished task', 'done', 1, 1800000000000, 1800000001000);
    INSERT INTO processed_chat_message (id, processed_at) VALUES ('message', 1800000000000);
  `,
  );
  run("source", ["execute", database, "--file", fixturePath]);
  const schemaPath = path.join(workDir, "schema.sql");
  const exportPath = path.join(workDir, "data.sql");
  // Create every parent table before inserting any child rows from the export.
  run("source", ["export", database, "--no-data", "--output", schemaPath]);
  run("restored", ["execute", database, "--file", schemaPath]);
  run("source", ["export", database, "--no-schema", "--output", exportPath]);
  writeFileSync(exportPath, `PRAGMA defer_foreign_keys = ON;\n${readFileSync(exportPath, "utf8")}`);
  run("restored", ["execute", database, "--file", exportPath]);

  const schemaSql =
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY type, name";
  const schema = query("source", schemaSql);
  assert.ok(schema.length > 0);
  assert.deepEqual(query("restored", schemaSql), schema, "Restored schema and indexes differ");
  const tables = schema
    .filter((entry) => entry.type === "table")
    .map((entry) => String(entry.name));
  const dataSql = tables
    .map((table) => {
      assert.match(table, /^[a-z_]+$/);
      return `SELECT '${table}' AS recovery_table, * FROM "${table}" ORDER BY rowid;`;
    })
    .join("\n");
  const original = query("source", dataSql);
  assert.deepEqual(query("restored", dataSql), original, "Restored rows differ");
  const rows = original.length;
  assert.ok(rows >= 13, "Synthetic fixture is incomplete");
  assert.deepEqual(query("restored", "PRAGMA foreign_key_check"), []);
  process.stdout.write(
    `Local recovery passed: ${tables.length} tables, ${rows} rows, matching schema/indexes and valid foreign keys.\n` +
      "Synthetic data only. Production export, Time Travel and Twitch/OBS behavior are not verified.\n",
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
