import { on } from "events";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { ee } from "../events";
import { buildTimerStylesConfig, buildTaskStylesConfig, buildTimerConfig } from "./config";
import * as schema from "@dirework/db/schema";

export const overlayRouter = router({
  getTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTimerToken, input.token),
        with: { timerState: true, timerConfig: true, timerStyle: true },
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
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTasksToken, input.token),
        columns: { id: true },
        with: { taskStyle: true },
      });
      if (!user) return null;

      const tasks = await ctx.db.query.task.findMany({
        where: eq(schema.task.ownerId, user.id),
        orderBy: [asc(schema.task.priority), asc(schema.task.order)],
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
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTimerToken, input.token),
        with: { timerState: true, timerConfig: true, timerStyle: true },
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
        const fresh = await ctx.db.query.user.findFirst({
          where: eq(schema.user.id, user.id),
          with: { timerState: true, timerConfig: true, timerStyle: true },
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
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTasksToken, input.token),
        columns: { id: true },
        with: { taskStyle: true },
      });
      if (!user) return;

      // Yield initial state
      const initialTasks = await ctx.db.query.task.findMany({
        where: eq(schema.task.ownerId, user.id),
        orderBy: [asc(schema.task.priority), asc(schema.task.order)],
      });
      yield {
        tasks: initialTasks,
        taskStyles: user.taskStyle ? buildTaskStylesConfig(user.taskStyle) : null,
      };

      // Then yield on every change
      for await (const _ of on(ee, `taskListChange:${user.id}`, { signal })) {
        const [freshUser, tasks] = await Promise.all([
          ctx.db.query.user.findFirst({
            where: eq(schema.user.id, user.id),
            columns: { id: true },
            with: { taskStyle: true },
          }),
          ctx.db.query.task.findMany({
            where: eq(schema.task.ownerId, user.id),
            orderBy: [asc(schema.task.priority), asc(schema.task.order)],
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
