import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee, TIMER_STATE_CHANGE } from "../events";
import { getTimerConfig, computeNextPhase } from "./timer-logic";
import * as schema from "@dirework/db/schema";

export const timerRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return (await ctx.db.query.timerState.findFirst()) ?? null;
  }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.db.query.instanceConfig.findFirst({
        columns: { overlayTimerToken: true },
      });
      if (!instance || instance.overlayTimerToken !== input.token) return null;
      return (await ctx.db.query.timerState.findFirst()) ?? null;
    }),

  start: protectedProcedure
    .input(
      z.object({
        totalCycles: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const timerConfigRow = await ctx.db.query.timerConfig.findFirst();
      const tc = getTimerConfig(timerConfigRow ?? null);

      const [result] = await ctx.db.insert(schema.timerState)
        .values({
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles: input.totalCycles ?? tc.defaultCycles,
        })
        .onConflictDoUpdate({
          target: schema.timerState.id,
          set: {
            status: "starting",
            targetEndTime: new Date(Date.now() + tc.startingDuration),
            pausedWithRemaining: null,
            pausedFromStatus: null,
            currentCycle: 1,
            totalCycles: input.totalCycles ?? tc.defaultCycles,
          },
        })
        .returning();
      ee.emit(TIMER_STATE_CHANGE);
      return result ?? null;
    }),

  nextPhase: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfigRow] = await Promise.all([
      ctx.db.query.timerState.findFirst(),
      ctx.db.query.timerConfig.findFirst(),
    ]);
    if (!timer) return null;

    const tc = getTimerConfig(timerConfigRow ?? null);
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status: timer.status, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
      tc,
    );

    if (nextStatus === timer.status && nextDuration === null && nextCycle === timer.currentCycle) {
      return timer;
    }

    const data: Record<string, unknown> = {
      status: nextStatus,
      currentCycle: nextCycle,
      pausedFromStatus: null,
    };

    if (nextDuration) {
      data.targetEndTime = new Date(Date.now() + nextDuration);
      data.pausedWithRemaining = null;
    } else {
      data.targetEndTime = null;
      data.pausedWithRemaining = null;
    }

    const [result] = await ctx.db.update(schema.timerState)
      .set(data)
      .returning();
    ee.emit(TIMER_STATE_CHANGE);
    return result ?? null;
  }),

  transition: protectedProcedure
    .input(z.object({ status: z.enum(["idle", "starting", "work", "break", "longBreak", "paused", "finished"]), durationMs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {
        status: input.status,
      };

      if (input.durationMs) {
        data.targetEndTime = new Date(Date.now() + input.durationMs);
        data.pausedWithRemaining = null;
      }

      if (input.status === "idle" || input.status === "finished") {
        data.targetEndTime = null;
        data.pausedWithRemaining = null;
      }

      const [result] = await ctx.db.update(schema.timerState)
        .set(data)
        .returning();
      ee.emit(TIMER_STATE_CHANGE);
      return result ?? null;
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.query.timerState.findFirst();
    if (!timer?.targetEndTime) return null;

    const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

    const [result] = await ctx.db.update(schema.timerState)
      .set({
        status: "paused",
        pausedFromStatus: timer.status,
        pausedWithRemaining: remaining,
        targetEndTime: null,
      })
      .returning();
    ee.emit(TIMER_STATE_CHANGE);
    return result!;
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.query.timerState.findFirst();
    if (!timer?.pausedWithRemaining) return null;

    const resumeStatus = timer.pausedFromStatus ?? "work";

    const [result] = await ctx.db.update(schema.timerState)
      .set({
        status: resumeStatus,
        targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
        pausedWithRemaining: null,
        pausedFromStatus: null,
      })
      .returning();
    ee.emit(TIMER_STATE_CHANGE);
    return result!;
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfigRow] = await Promise.all([
      ctx.db.query.timerState.findFirst(),
      ctx.db.query.timerConfig.findFirst(),
    ]);
    if (!timer) return null;

    const effectiveStatus = timer.status === "paused"
      ? (timer.pausedFromStatus ?? "work")
      : timer.status;

    const tc = getTimerConfig(timerConfigRow ?? null);
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status: effectiveStatus, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
      tc,
    );

    const data: Record<string, unknown> = {
      status: nextStatus,
      currentCycle: nextCycle,
      pausedFromStatus: null,
      pausedWithRemaining: null,
    };

    if (nextDuration) {
      data.targetEndTime = new Date(Date.now() + nextDuration);
    } else {
      data.targetEndTime = null;
    }

    const [result] = await ctx.db.update(schema.timerState)
      .set(data)
      .returning();
    ee.emit(TIMER_STATE_CHANGE);
    return result ?? null;
  }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const [result] = await ctx.db.update(schema.timerState)
      .set({
        status: "idle",
        targetEndTime: null,
        pausedWithRemaining: null,
        pausedFromStatus: null,
        currentCycle: 1,
        totalCycles: 4,
      })
      .returning();
    ee.emit(TIMER_STATE_CHANGE);
    return result ?? null;
  }),
});
