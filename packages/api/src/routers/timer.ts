import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import {
  getTimerState,
  nextPhase,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
  transitionTimer,
} from "../services/timer-service";
import { tokenInput, verifyOverlayToken } from "../services/tokens";

export const timerRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getTimerState(ctx.db);
  }),

  getByToken: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ ctx, input }) => {
      if (!(await verifyOverlayToken(ctx.db, "timer", input.token))) return null;
      return getTimerState(ctx.db);
    }),

  start: protectedProcedure
    .input(
      z.object({
        totalCycles: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return startTimer(ctx.db, { totalCycles: input.totalCycles });
    }),

  nextPhase: protectedProcedure.mutation(async ({ ctx }) => {
    return nextPhase(ctx.db);
  }),

  transition: protectedProcedure
    .input(z.object({
      status: z.enum(["idle", "starting", "work", "break", "longBreak", "paused", "finished"]),
      durationMs: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return transitionTimer(ctx.db, input.status, input.durationMs);
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    return pauseTimer(ctx.db);
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    return resumeTimer(ctx.db);
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    return skipTimer(ctx.db);
  }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    return resetTimer(ctx.db);
  }),
});
