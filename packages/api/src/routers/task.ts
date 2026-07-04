import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { MAX_TASK_LEN } from "../config-shared";
import { protectedProcedure, publicProcedure, router } from "../index";
import {
  activateTask,
  clearAllTasks,
  clearDoneTasks,
  clearViewerTasks,
  createTask,
  editTask,
  listTasks,
  markTaskDone,
  removeTask,
  removeTasksByViewer,
} from "../services/task-service";
import { tokenInput, verifyOverlayToken } from "../services/tokens";

export const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listTasks(ctx.db);
  }),

  listByToken: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ ctx, input }) => {
      if (!(await verifyOverlayToken(ctx.db, "tasks", input.token))) return [];
      return listTasks(ctx.db);
    }),

  create: protectedProcedure
    .input(
      z.object({
        authorTwitchId: z.string(),
        authorUsername: z.string(),
        authorDisplayName: z.string(),
        authorColor: z.string().optional(),
        text: z.string().min(1).max(MAX_TASK_LEN),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createTask(
        ctx.db,
        {
          twitchId: input.authorTwitchId,
          username: input.authorUsername,
          displayName: input.authorDisplayName,
          color: input.authorColor ?? null,
        },
        input.text,
      );
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return markTaskDone(ctx.db, input.id);
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.task.findFirst({
        where: (t, { eq }) => eq(t.id, input.id),
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      if (task.status === "done") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot activate a completed task" });
      }
      return activateTask(ctx.db, task);
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(MAX_TASK_LEN) }))
    .mutation(async ({ ctx, input }) => {
      return editTask(ctx.db, input.id, input.text);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return removeTask(ctx.db, input.id);
    }),

  // ── Broadcaster moderation ────────────────────────────────

  removeByViewer: protectedProcedure
    .input(z.object({ authorTwitchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return removeTasksByViewer(ctx.db, input.authorTwitchId);
    }),

  moderateEdit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(MAX_TASK_LEN) }))
    .mutation(async ({ ctx, input }) => {
      return editTask(ctx.db, input.id, input.text);
    }),

  moderateRemove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return removeTask(ctx.db, input.id);
    }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    return clearAllTasks(ctx.db);
  }),

  clearDone: protectedProcedure.mutation(async ({ ctx }) => {
    return clearDoneTasks(ctx.db);
  }),

  clearViewers: protectedProcedure.mutation(async ({ ctx }) => {
    return clearViewerTasks(ctx.db);
  }),
});
