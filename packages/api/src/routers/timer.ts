import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

const defaultTimerConfig = {
  workDuration: 25 * 60 * 1000,
  breakDuration: 5 * 60 * 1000,
  longBreakDuration: 15 * 60 * 1000,
  longBreakInterval: 4,
  startingDuration: 5000,
  defaultCycles: 4,
  noLastBreak: true,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function getTimerConfig(configTimer: unknown) {
  const tc = (configTimer ?? {}) as AnyRecord;
  return {
    workDuration: (tc.workDuration as number) ?? defaultTimerConfig.workDuration,
    breakDuration: (tc.breakDuration as number) ?? defaultTimerConfig.breakDuration,
    longBreakDuration: (tc.longBreakDuration as number) ?? defaultTimerConfig.longBreakDuration,
    longBreakInterval: (tc.longBreakInterval as number) ?? defaultTimerConfig.longBreakInterval,
    startingDuration: (tc.startingDuration as number) ?? defaultTimerConfig.startingDuration,
    noLastBreak: (tc.noLastBreak as boolean) ?? defaultTimerConfig.noLastBreak,
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
      const config = await ctx.prisma.config.findUnique({
        where: { userId: ctx.session.user.id },
      });
      const tc = getTimerConfig(config?.timer);

      return ctx.prisma.timerState.upsert({
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
    }),

  nextPhase: protectedProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer) return null;

    const config = await ctx.prisma.config.findUnique({
      where: { userId: ctx.session.user.id },
    });
    const tc = getTimerConfig(config?.timer);

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

    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data,
    });
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
        pausedFromStatus: timer.status,
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

    const resumeStatus = timer.pausedFromStatus ?? "work";

    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data: {
        status: resumeStatus,
        targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
        pausedWithRemaining: null,
        pausedFromStatus: null,
      },
    });
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    // Skip delegates to nextPhase logic — find current state, advance to next phase
    const timer = await ctx.prisma.timerState.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!timer) return null;

    // If paused, treat as skipping the phase we paused from
    const effectiveStatus = timer.status === "paused"
      ? (timer.pausedFromStatus ?? "work")
      : timer.status;

    const config = await ctx.prisma.config.findUnique({
      where: { userId: ctx.session.user.id },
    });
    const tc = getTimerConfig(config?.timer);

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

    return ctx.prisma.timerState.update({
      where: { userId: ctx.session.user.id },
      data,
    });
  }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.timerState.update({
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
  }),
});
