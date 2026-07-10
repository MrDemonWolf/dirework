import { z } from "zod";

import { publicProcedure, router } from "../index";
import {
  loadTaskOverlayPayload,
  loadTimerOverlayPayload,
} from "../services/overlay-service";
import { tokenInput, withOverlayToken } from "../services/tokens";

// Overlays poll these plain queries (React Query refetchInterval) — the SSE
// subscriptions and the in-process event bus are gone.

export const overlayRouter = router({
  getTimerState: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ ctx, input }) => {
      return withOverlayToken(ctx.db, "timer", input.token, () =>
        loadTimerOverlayPayload(ctx.db),
      );
    }),

  getTaskList: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ ctx, input }) => {
      return withOverlayToken(ctx.db, "tasks", input.token, () =>
        loadTaskOverlayPayload(ctx.db),
      );
    }),
});
