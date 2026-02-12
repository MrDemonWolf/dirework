import { env } from "@dirework/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
export type {
  TimerConfigModel as TimerConfig,
  TimerStyleModel as TimerStyle,
  TaskStyleModel as TaskStyle,
  BotConfigModel as BotConfig,
} from "../prisma/generated/models";
