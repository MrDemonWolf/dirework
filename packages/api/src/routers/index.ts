import { publicProcedure, router } from "../index";

import { botRouter } from "./bot";
import { configRouter } from "./config";
import { overlayRouter } from "./overlay";
import { taskRouter } from "./task";
import { timerRouter } from "./timer";
import { userRouter } from "./user";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  user: userRouter,
  task: taskRouter,
  timer: timerRouter,
  config: configRouter,
  overlay: overlayRouter,
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
