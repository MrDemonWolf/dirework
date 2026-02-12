import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee } from "../events";

// Default values matching Prisma @default() values for TimerConfig
const DEFAULTS = {
  workDuration: 1500000,
  breakDuration: 300000,
  longBreakDuration: 900000,
  longBreakInterval: 4,
  startingDuration: 5000,
  noLastBreak: true,
};

function getTimerConfig(tc: {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startingDuration: number;
  noLastBreak: boolean;
} | null) {
  return {
    workDuration: tc?.workDuration ?? DEFAULTS.workDuration,
    breakDuration: tc?.breakDuration ?? DEFAULTS.breakDuration,
    longBreakDuration: tc?.longBreakDuration ?? DEFAULTS.longBreakDuration,
    longBreakInterval: tc?.longBreakInterval ?? DEFAULTS.longBreakInterval,
    startingDuration: tc?.startingDuration ?? DEFAULTS.startingDuration,
    noLastBreak: tc?.noLastBreak ?? DEFAULTS.noLastBreak,
  };
}

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

    let nextStatus: string;
    let nextDuration: number | null = null;
    let nextCycle = timer.currentCycle;

    switch (timer.status) {
      case "starting":
        nextStatus = "work";
        nextDuration = tc.workDuration;
        break;

      case "work":
        if (timer.currentCycle >= timer.totalCycles) {
          if (tc.noLastBreak) {
            nextStatus = "finished";
          } else {
            nextStatus =
              timer.currentCycle % tc.longBreakInterval === 0
                ? "longBreak"
                : "break";
            nextDuration =
              nextStatus === "longBreak"
                ? tc.longBreakDuration
                : tc.breakDuration;
          }
        } else {
          nextStatus =
            timer.currentCycle % tc.longBreakInterval === 0
              ? "longBreak"
              : "break";
          nextDuration =
            nextStatus === "longBreak"
              ? tc.longBreakDuration
              : tc.breakDuration;
        }
        break;

      case "break":
      case "longBreak":
        nextCycle = timer.currentCycle + 1;
        if (nextCycle > timer.totalCycles) {
          nextStatus = "finished";
        } else {
          nextStatus = "work";
          nextDuration = tc.workDuration;
        }
        break;

      default:
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

    let nextStatus: string;
    let nextDuration: number | null = null;
    let nextCycle = timer.currentCycle;

    switch (effectiveStatus) {
      case "starting":
        nextStatus = "work";
        nextDuration = tc.workDuration;
        break;

      case "work":
        if (timer.currentCycle >= timer.totalCycles) {
          if (tc.noLastBreak) {
            nextStatus = "finished";
          } else {
            nextStatus =
              timer.currentCycle % tc.longBreakInterval === 0
                ? "longBreak"
                : "break";
            nextDuration =
              nextStatus === "longBreak"
                ? tc.longBreakDuration
                : tc.breakDuration;
          }
        } else {
          nextStatus =
            timer.currentCycle % tc.longBreakInterval === 0
              ? "longBreak"
              : "break";
          nextDuration =
            nextStatus === "longBreak"
              ? tc.longBreakDuration
              : tc.breakDuration;
        }
        break;

      case "break":
      case "longBreak":
        nextCycle = timer.currentCycle + 1;
        if (nextCycle > timer.totalCycles) {
          nextStatus = "finished";
        } else {
          nextStatus = "work";
          nextDuration = tc.workDuration;
        }
        break;

      default:
        nextStatus = "idle";
        break;
    }

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
