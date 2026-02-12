import { on } from "events";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { ee } from "../events";
import { buildTimerStylesConfig, buildTaskStylesConfig, buildTimerConfig } from "./config";

export const overlayRouter = router({
  getTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTimerToken: input.token },
        include: { timerState: true, timerConfig: true, timerStyle: true },
      });
      if (!user) return null;

      return {
        timerState: user.timerState,
        timerConfig: user.timerConfig ? buildTimerConfig(user.timerConfig) : null,
        timerStyles: user.timerStyle ? buildTimerStylesConfig(user.timerStyle) : null,
      };
    }),

  getTaskList: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTasksToken: input.token },
        select: { id: true, taskStyle: true },
      });
      if (!user) return null;

      const tasks = await ctx.prisma.task.findMany({
        where: { ownerId: user.id },
        orderBy: [{ priority: "asc" }, { order: "asc" }],
      });

      return {
        tasks,
        taskStyles: user.taskStyle ? buildTaskStylesConfig(user.taskStyle) : null,
      };
    }),

  // ── SSE subscriptions ─────────────────────────────────────────────────────

  onTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTimerToken: input.token },
        include: { timerState: true, timerConfig: true, timerStyle: true },
      });
      if (!user) return;

      // Yield initial state immediately
      yield {
        timerState: user.timerState,
        timerConfig: user.timerConfig ? buildTimerConfig(user.timerConfig) : null,
        timerStyles: user.timerStyle ? buildTimerStylesConfig(user.timerStyle) : null,
      };

      // Then yield on every change
      for await (const _ of on(ee, `timerStateChange:${user.id}`, { signal })) {
        const fresh = await ctx.prisma.user.findFirst({
          where: { id: user.id },
          include: { timerState: true, timerConfig: true, timerStyle: true },
        });
        if (!fresh) return;
        yield {
          timerState: fresh.timerState,
          timerConfig: fresh.timerConfig ? buildTimerConfig(fresh.timerConfig) : null,
          timerStyles: fresh.timerStyle ? buildTimerStylesConfig(fresh.timerStyle) : null,
        };
      }
    }),

  onTaskList: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTasksToken: input.token },
        select: { id: true, taskStyle: true },
      });
      if (!user) return;

      // Yield initial state
      const initialTasks = await ctx.prisma.task.findMany({
        where: { ownerId: user.id },
        orderBy: [{ priority: "asc" }, { order: "asc" }],
      });
      yield {
        tasks: initialTasks,
        taskStyles: user.taskStyle ? buildTaskStylesConfig(user.taskStyle) : null,
      };

      // Then yield on every change
      for await (const _ of on(ee, `taskListChange:${user.id}`, { signal })) {
        const [freshUser, tasks] = await Promise.all([
          ctx.prisma.user.findFirst({
            where: { id: user.id },
            select: { id: true, taskStyle: true },
          }),
          ctx.prisma.task.findMany({
            where: { ownerId: user.id },
            orderBy: [{ priority: "asc" }, { order: "asc" }],
          }),
        ]);
        if (!freshUser) return;
        yield {
          tasks,
          taskStyles: freshUser.taskStyle ? buildTaskStylesConfig(freshUser.taskStyle) : null,
        };
      }
    }),
});
