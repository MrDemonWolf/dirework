import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

const timerStatusEnum = z.enum([
  "idle",
  "starting",
  "work",
  "break",
  "longBreak",
  "paused",
  "finished",
]);

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
      const config = await ctx.prisma.config.findUnique({
        where: { userId: ctx.session.user.id },
      });
      const timerConfig = config?.timer as Record<string, number> | null;
      const startingDuration = timerConfig?.startingDuration ?? 5000;

      return ctx.prisma.timerState.upsert({
        where: { userId: ctx.session.user.id },
        update: {
          status: "starting",
          targetEndTime: new Date(Date.now() + startingDuration),
          pausedWithRemaining: null,
          currentCycle: 1,
          totalCycles: input.totalCycles ?? 4,
        },
        create: {
          userId: ctx.session.user.id,
          status: "starting",
          targetEndTime: new Date(Date.now() + startingDuration),
          currentCycle: 1,
          totalCycles: input.totalCycles ?? 4,
        },
      });
    }),

  transition: protectedProcedure
    .input(z.object({ status: timerStatusEnum, durationMs: z.number().optional() }))
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

      return ctx.prisma.timerState.update({
        where: { userId: ctx.session.user.id },
        data,
      });
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer?.targetEndTime) return timer;

    const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "paused",
        pausedWithRemaining: remaining,
        targetEndTime: null,

      },
    });
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer?.pausedWithRemaining) return timer;

    // Determine what status to resume to based on what was before pause
    // We'll resume to "work" or "break" depending on context - for now default to work
    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "work",
        targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
        pausedWithRemaining: null,

      },
    });
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "idle",
        targetEndTime: null,
        pausedWithRemaining: null,

      },
    });
  }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: "idle",
        targetEndTime: null,
        pausedWithRemaining: null,
        currentCycle: 1,
        totalCycles: 4,

      },
    });
  }),
});
