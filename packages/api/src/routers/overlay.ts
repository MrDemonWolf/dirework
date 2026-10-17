// Public, token-gated reads for the OBS overlays (`/overlay/t/<token>`, `/overlay/l/<token>`).
// Called direct to the api worker via `publicTrpc` (no cookies, no proxy hop).

import { z } from "zod";

import { publicProcedure, router } from "../index";
import { loadTaskOverlayPayload, loadTimerOverlayPayload } from "../services/overlay-service";
import { tokenInput, withOverlayToken } from "../services/tokens";

// Overlays poll these POST mutations (React Query refetchInterval) — the SSE
// subscriptions and the in-process event bus are gone. They are mutations, not
// queries, so the overlay token travels in the request body and never lands in
// a URL or a log line. Both return null for an invalid or reset token, which the
// overlay renders as nothing.

export const overlayRouter = router({
  /**
   * publicProcedure, timer-token gated → overlay-service `loadTimerOverlayPayload`.
   * Not read-only: it lazily advances an overdue timer phase, since nothing else
   * runs between requests on Workers.
   */
  getTimerState: publicProcedure
    .input(z.object({ token: tokenInput }))
    .mutation(async ({ ctx, input }) => {
      return withOverlayToken(ctx.db, "timer", input.token, () => loadTimerOverlayPayload(ctx.db));
    }),

  /** publicProcedure, tasks-token gated → overlay-service `loadTaskOverlayPayload`. */
  getTaskList: publicProcedure
    .input(z.object({ token: tokenInput }))
    .mutation(async ({ ctx, input }) => {
      return withOverlayToken(ctx.db, "tasks", input.token, () => loadTaskOverlayPayload(ctx.db));
    }),
});
