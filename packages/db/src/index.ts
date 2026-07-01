import { env } from "@dirework/env/server";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Per-request factory — Workers isolate per request, no module-level singletons.
export function createDb() {
  return drizzle(env.DB, { schema });
}

export type DbClient = ReturnType<typeof createDb>;

export * as schema from "./schema";

export type TimerConfig = typeof schema.timerConfig.$inferSelect;
export type TimerStyle = typeof schema.timerStyle.$inferSelect;
export type TaskStyle = typeof schema.taskStyle.$inferSelect;
export type BotConfig = typeof schema.botConfig.$inferSelect;
export type InstanceConfig = typeof schema.instanceConfig.$inferSelect;
