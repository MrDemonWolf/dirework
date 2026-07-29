import { ownerProcedure, router } from "../index";
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
  get: ownerProcedure.query(async ({ ctx }) => {
    return getTimerState(ctx.db);
  }),

  start: ownerProcedure
    .input(timerStartInput)
    .mutation(async ({ ctx, input }) => {
      return startTimer(ctx.db, { totalCycles: input.totalCycles });
    }),

  pause: ownerProcedure.mutation(async ({ ctx }) => {
    return pauseTimer(ctx.db);
  }),

  resume: ownerProcedure.mutation(async ({ ctx }) => {
    return resumeTimer(ctx.db);
  }),

  skip: ownerProcedure.mutation(async ({ ctx }) => {
    return skipTimer(ctx.db);
  }),

  reset: ownerProcedure.mutation(async ({ ctx }) => {
    return resetTimer(ctx.db);
  }),
});
