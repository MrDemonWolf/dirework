// Dashboard timer controls. All ownerProcedure; each delegates to the matching
// timer-service function, which the chat `!timer` commands also call.

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
  /** Current timer row; lazily advances an overdue phase first (`getTimerState`). */
  get: ownerProcedure.query(async ({ ctx }) => {
    return getTimerState(ctx.db);
  }),

  /** Start or restart in the "starting" phase (`startTimer`); totalCycles is optional. */
  start: ownerProcedure.input(timerStartInput).mutation(async ({ ctx, input }) => {
    return startTimer(ctx.db, { totalCycles: input.totalCycles });
  }),

  /** `pauseTimer` — stores the remaining ms. */
  pause: ownerProcedure.mutation(async ({ ctx }) => {
    return pauseTimer(ctx.db);
  }),

  /** `resumeTimer` — re-anchors the end time from the stored remaining ms. */
  resume: ownerProcedure.mutation(async ({ ctx }) => {
    return resumeTimer(ctx.db);
  }),

  /** Advance to the next phase (`skipTimer`); null when there is nothing to skip. */
  skip: ownerProcedure.mutation(async ({ ctx }) => {
    return skipTimer(ctx.db);
  }),

  /** Back to idle with the configured default cycle count (`resetTimer`). */
  reset: ownerProcedure.mutation(async ({ ctx }) => {
    return resetTimer(ctx.db);
  }),
});
