import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee } from "../events";
import { getTimerConfig, computeNextPhase } from "./timer-logic";
import * as schema from "@dirework/db/schema";

export const timerRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const state = await ctx.db.query.timerState.findFirst({
      where: eq(schema.timerState.userId, ctx.session.user.id),
    });
    return state ?? null;
  }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTimerToken, input.token),
        columns: { id: true },
      });
      if (!user) return null;
      return (await ctx.db.query.timerState.findFirst({
        where: eq(schema.timerState.userId, user.id),
      })) ?? null;
    }),

  start: protectedProcedure
    .input(
      z.object({
        totalCycles: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const timerConfigRow = await ctx.db.query.timerConfig.findFirst({
        where: eq(schema.timerConfig.userId, ctx.session.user.id),
      });
      const tc = getTimerConfig(timerConfigRow ?? null);

      const [result] = await ctx.db.insert(schema.timerState)
        .values({
          userId: ctx.session.user.id,
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles: input.totalCycles ?? 4,
        })
        .onConflictDoUpdate({
          target: schema.timerState.userId,
          set: {
            status: "starting",
            targetEndTime: new Date(Date.now() + tc.startingDuration),
            pausedWithRemaining: null,
            pausedFromStatus: null,
            currentCycle: 1,
            totalCycles: input.totalCycles ?? 4,
          },
        })
        .returning();
      ee.emit(`timerStateChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  nextPhase: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfigRow] = await Promise.all([
      ctx.db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ctx.session.user.id) }),
      ctx.db.query.timerConfig.findFirst({ where: eq(schema.timerConfig.userId, ctx.session.user.id) }),
    ]);
    if (!timer) return null;

    const tc = getTimerConfig(timerConfigRow ?? null);
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status: timer.status, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
      tc,
    );

    // Unknown status — no transition
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
      .where(eq(schema.timerState.userId, ctx.session.user.id))
      .returning();
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result ?? null;
  }),

  transition: protectedProcedure
    .input(z.object({ status: z.string(), durationMs: z.number().optional() }))
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
        .where(eq(schema.timerState.userId, ctx.session.user.id))
        .returning();
      ee.emit(`timerStateChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.query.timerState.findFirst({
      where: eq(schema.timerState.userId, ctx.session.user.id),
    });
    if (!timer?.targetEndTime) return null;

    const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

    const [result] = await ctx.db.update(schema.timerState)
      .set({
        status: "paused",
        pausedFromStatus: timer.status,
        pausedWithRemaining: remaining,
        targetEndTime: null,
      })
      .where(eq(schema.timerState.userId, ctx.session.user.id))
      .returning();
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result!;
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.query.timerState.findFirst({
      where: eq(schema.timerState.userId, ctx.session.user.id),
    });
    if (!timer?.pausedWithRemaining) return null;

    const resumeStatus = timer.pausedFromStatus ?? "work";

    const [result] = await ctx.db.update(schema.timerState)
      .set({
        status: resumeStatus,
        targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
        pausedWithRemaining: null,
        pausedFromStatus: null,
      })
      .where(eq(schema.timerState.userId, ctx.session.user.id))
      .returning();
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result!;
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfigRow] = await Promise.all([
      ctx.db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ctx.session.user.id) }),
      ctx.db.query.timerConfig.findFirst({ where: eq(schema.timerConfig.userId, ctx.session.user.id) }),
    ]);
    if (!timer) return null;

    // If paused, treat as skipping the phase we paused from
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
      .where(eq(schema.timerState.userId, ctx.session.user.id))
      .returning();
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
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
      .where(eq(schema.timerState.userId, ctx.session.user.id))
      .returning();
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result ?? null;
  }),
});
