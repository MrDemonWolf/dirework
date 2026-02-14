import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee } from "../events";
import { getTimerConfig, computeNextPhase } from "./timer-logic";

export const timerRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
  }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTimerToken: input.token },
        select: { id: true },
      });
      if (!user) return null;
      return ctx.prisma.timerState.findUnique({
        where: { userId: user.id },
      });
    }),

  start: protectedProcedure
    .input(
      z.object({
        totalCycles: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const timerConfig = await ctx.prisma.timerConfig.findUnique({
        where: { userId: ctx.session.user.id },
      });
      const tc = getTimerConfig(timerConfig);

      const result = await ctx.prisma.timerState.upsert({
        where: { userId: ctx.session.user.id },
        update: {
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles: input.totalCycles ?? 4,
        },
        create: {
          userId: ctx.session.user.id,
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          currentCycle: 1,
          totalCycles: input.totalCycles ?? 4,
        },
      });
      ee.emit(`timerStateChange:${ctx.session.user.id}`);
      return result;
    }),

  nextPhase: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfig] = await Promise.all([
      ctx.prisma.timerState.findUnique({ where: { userId: ctx.session.user.id } }),
      ctx.prisma.timerConfig.findUnique({ where: { userId: ctx.session.user.id } }),
    ]);
    if (!timer) return null;

    const tc = getTimerConfig(timerConfig);
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

    const result = await ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data,
    });
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result;
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

      const result = await ctx.prisma.timerState.update({
        where: { userId: ctx.session.user.id },
        data,
      });
      ee.emit(`timerStateChange:${ctx.session.user.id}`);
      return result;
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer?.targetEndTime) return timer;

    const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

    const result = await ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "paused",
        pausedFromStatus: timer.status,
        pausedWithRemaining: remaining,
        targetEndTime: null,
      },
    });
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result;
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer?.pausedWithRemaining) return timer;

    const resumeStatus = timer.pausedFromStatus ?? "work";

    const result = await ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: resumeStatus,
        targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
        pausedWithRemaining: null,
        pausedFromStatus: null,
      },
    });
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result;
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const [timer, timerConfig] = await Promise.all([
      ctx.prisma.timerState.findUnique({ where: { userId: ctx.session.user.id } }),
      ctx.prisma.timerConfig.findUnique({ where: { userId: ctx.session.user.id } }),
    ]);
    if (!timer) return null;

    // If paused, treat as skipping the phase we paused from
    const effectiveStatus = timer.status === "paused"
      ? (timer.pausedFromStatus ?? "work")
      : timer.status;

    const tc = getTimerConfig(timerConfig);
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

    const result = await ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data,
    });
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result;
  }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "idle",
        targetEndTime: null,
        pausedWithRemaining: null,
        pausedFromStatus: null,
        currentCycle: 1,
        totalCycles: 4,
      },
    });
    ee.emit(`timerStateChange:${ctx.session.user.id}`);
    return result;
  }),
});
