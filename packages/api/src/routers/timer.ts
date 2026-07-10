import { protectedProcedure, router } from "../index";
import {
  getTimerState,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
} from "../services/timer-service";
import { timerStartInput } from "./input-schemas";

export const timerRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getTimerState(ctx.db);
  }),

  start: protectedProcedure
    .input(timerStartInput)
    .mutation(async ({ ctx, input }) => {
      return startTimer(ctx.db, { totalCycles: input.totalCycles });
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
