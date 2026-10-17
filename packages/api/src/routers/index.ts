// Root tRPC router: composes every feature router. The api worker mounts it at
// `/trpc/*`; the web app reaches it through the same-origin `/rpc` proxy
// (authed) or directly via `publicTrpc` (token-gated overlay/bot traffic).

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

/** Router type the web app's tRPC clients are typed against (type-only import). */
export type AppRouter = typeof appRouter;
