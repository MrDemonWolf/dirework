import { TRPCError } from "@trpc/server";

import { ownerProcedure, router } from "../index";
import {
  activateTask,
  clearAllTasks,
  clearDoneTasks,
  createTask,
  listTasks,
  markTaskDone,
  removeTask,
} from "../services/task-service";
import { taskCreateInput, taskIdInput } from "./input-schemas";

export const taskRouter = router({
  list: ownerProcedure.query(async ({ ctx }) => {
    return listTasks(ctx.db);
  }),

  create: ownerProcedure
    .input(taskCreateInput)
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

  markDone: ownerProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      return markTaskDone(ctx.db, input.id);
    }),

  activate: ownerProcedure
    .input(taskIdInput)
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

  remove: ownerProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      return removeTask(ctx.db, input.id);
    }),

  clearAll: ownerProcedure.mutation(async ({ ctx }) => {
    return clearAllTasks(ctx.db);
  }),

  clearDone: ownerProcedure.mutation(async ({ ctx }) => {
    return clearDoneTasks(ctx.db);
  }),
});
