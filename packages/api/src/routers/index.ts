import { router } from "../index";

import { botRouter } from "./bot";
import { configRouter } from "./config";
import { overlayRouter } from "./overlay";
import { taskRouter } from "./task";
import { timerRouter } from "./timer";
import { userRouter } from "./user";

// No healthCheck procedure here — the real healthcheck is the api worker's
// plain `/health` route (apps/server).
export const appRouter = router({
  user: userRouter,
  task: taskRouter,
  timer: timerRouter,
  config: configRouter,
  overlay: overlayRouter,
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
