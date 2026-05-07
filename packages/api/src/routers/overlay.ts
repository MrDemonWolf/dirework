import { on } from "events";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { ee, TIMER_STATE_CHANGE, TASK_LIST_CHANGE } from "../events";
import { buildTimerStylesConfig, buildTaskStylesConfig, buildTimerConfig } from "./config";
import * as schema from "@dirework/db/schema";

export const overlayRouter = router({
  getTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.db.query.instanceConfig.findFirst();
      if (!instance || instance.overlayTimerToken !== input.token) return null;

      const [timerState, timerConfigRow, timerStyleRow] = await Promise.all([
        ctx.db.query.timerState.findFirst(),
        ctx.db.query.timerConfig.findFirst(),
        ctx.db.query.timerStyle.findFirst(),
      ]);

      return {
        timerState: timerState ?? null,
        timerConfig: timerConfigRow ? buildTimerConfig(timerConfigRow) : null,
        timerStyles: timerStyleRow ? buildTimerStylesConfig(timerStyleRow) : null,
      };
    }),

  getTaskList: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.db.query.instanceConfig.findFirst();
      if (!instance || instance.overlayTasksToken !== input.token) return null;

      const [tasks, taskStyleRow] = await Promise.all([
        ctx.db.query.task.findMany({
          orderBy: [asc(schema.task.priority), asc(schema.task.order)],
        }),
        ctx.db.query.taskStyle.findFirst(),
      ]);

      return {
        tasks,
        taskStyles: taskStyleRow ? buildTaskStylesConfig(taskStyleRow) : null,
      };
    }),

  // ── SSE subscriptions ─────────────────────────────────────────────────────

  onTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const instance = await ctx.db.query.instanceConfig.findFirst();
      if (!instance || instance.overlayTimerToken !== input.token) return;

      // Yield initial state immediately
      const [timerState, timerConfigRow, timerStyleRow] = await Promise.all([
        ctx.db.query.timerState.findFirst(),
        ctx.db.query.timerConfig.findFirst(),
        ctx.db.query.timerStyle.findFirst(),
      ]);
      yield {
        timerState: timerState ?? null,
        timerConfig: timerConfigRow ? buildTimerConfig(timerConfigRow) : null,
        timerStyles: timerStyleRow ? buildTimerStylesConfig(timerStyleRow) : null,
      };

      // Then yield on every change
      for await (const _ of on(ee, TIMER_STATE_CHANGE, { signal })) {
        const [freshTimerState, freshConfig, freshStyle] = await Promise.all([
          ctx.db.query.timerState.findFirst(),
          ctx.db.query.timerConfig.findFirst(),
          ctx.db.query.timerStyle.findFirst(),
        ]);
        yield {
          timerState: freshTimerState ?? null,
          timerConfig: freshConfig ? buildTimerConfig(freshConfig) : null,
          timerStyles: freshStyle ? buildTimerStylesConfig(freshStyle) : null,
        };
      }
    }),

  onTaskList: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const instance = await ctx.db.query.instanceConfig.findFirst();
      if (!instance || instance.overlayTasksToken !== input.token) return;

      // Yield initial state
      const [initialTasks, taskStyleRow] = await Promise.all([
        ctx.db.query.task.findMany({
          orderBy: [asc(schema.task.priority), asc(schema.task.order)],
        }),
        ctx.db.query.taskStyle.findFirst(),
      ]);
      yield {
        tasks: initialTasks,
        taskStyles: taskStyleRow ? buildTaskStylesConfig(taskStyleRow) : null,
      };

      // Then yield on every change
      for await (const _ of on(ee, TASK_LIST_CHANGE, { signal })) {
        const [tasks, freshStyle] = await Promise.all([
          ctx.db.query.task.findMany({
            orderBy: [asc(schema.task.priority), asc(schema.task.order)],
          }),
          ctx.db.query.taskStyle.findFirst(),
        ]);
        yield {
          tasks,
          taskStyles: freshStyle ? buildTaskStylesConfig(freshStyle) : null,
        };
      }
    }),
});
