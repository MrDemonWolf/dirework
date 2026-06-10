import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@dirework/env/server";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Drain pool connections on shutdown so Postgres isn't left with orphaned
// sessions across container restarts. `once` keeps dev HMR from stacking handlers.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void pool.end().finally(() => process.exit(0));
  });
}

export type DbClient = typeof db;

export type TimerConfig = typeof schema.timerConfig.$inferSelect;
export type TimerStyle = typeof schema.timerStyle.$inferSelect;
export type TaskStyle = typeof schema.taskStyle.$inferSelect;
export type BotConfig = typeof schema.botConfig.$inferSelect;
export type InstanceConfig = typeof schema.instanceConfig.$inferSelect;
