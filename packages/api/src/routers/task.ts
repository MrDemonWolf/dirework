// Dashboard task list procedures. Every one is ownerProcedure (session AND
// isOwner) and delegates to task-service, the same functions chat commands use
// via bot.ingest — no mutation logic lives here (audit M1).

import { TRPCError } from "@trpc/server";

import { ownerProcedure, router } from "../index";
import {
  activateTask,
  clearAllTasks,
  clearDoneTasks,
  createTask,
  listTasks,
  markTaskDone,
  pauseTask,
  removeTask,
  resolveOwnerTaskId,
  restoreTask,
  startTask,
} from "../services/task-service";
import { MAX_OPEN_TASKS } from "../config-defaults";
import {
  isRestorableAuthor,
  taskCreateInput,
  taskIdInput,
  taskRestoreInput,
} from "./input-schemas";

/** Refusal when the list already holds MAX_OPEN_TASKS open tasks. */
export const TASK_LIST_FULL_MESSAGE = `The task list is full (${MAX_OPEN_TASKS} open tasks). Finish or clear some first.`;

const taskListFull = () =>
  new TRPCError({ code: "PRECONDITION_FAILED", message: TASK_LIST_FULL_MESSAGE });

export const taskRouter = router({
  /** Open tasks + newest done tasks, with index-backed counts (`listTasks`). */
  list: ownerProcedure.query(async ({ ctx }) => {
    return listTasks(ctx.db);
  }),

  /**
   * Add a task authored by the owner (`createTask`). The author key is the
   * owner's Twitch ID, so dashboard and chat tasks from the owner group together.
   */
  create: ownerProcedure.input(taskCreateInput).mutation(async ({ ctx, input }) => {
    const authorTwitchId = await resolveOwnerTaskId(ctx.db, ctx.session.user);
    const created = await createTask(
      ctx.db,
      {
        twitchId: authorTwitchId,
        username: ctx.session.user.name,
        displayName: ctx.session.user.displayName ?? ctx.session.user.name,
        color: null,
      },
      input.text,
    );
    // Null only when the instance-wide open-task cap refused the insert.
    if (!created) throw taskListFull();
    return created;
  }),

  /** Complete a task and promote the author's next pending one (`markTaskDone`). */
  markDone: ownerProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    return markTaskDone(ctx.db, input.id);
  }),

  /** Make a task its author's single active task (`activateTask`); done tasks are refused. */
  activate: ownerProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    const task = await ctx.db.query.task.findFirst({
      where: (t, { eq }) => eq(t.id, input.id),
    });
    if (!task) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }
    if (task.status === "done") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Can't activate a completed task" });
    }
    return activateTask(ctx.db, task);
  }),

  /**
   * Start a pending task (`startTask`): it becomes the focus when the author has
   * none, else a parked `started` task while under MAX_STARTED_PER_AUTHOR.
   * Returns the outcome (`cap_reached` / `not_startable` change nothing).
   */
  start: ownerProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    return startTask(ctx.db, input.id);
  }),

  /** Pause a started task or the focus back to pending (`pauseTask`). */
  pause: ownerProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    return pauseTask(ctx.db, input.id);
  }),

  /** Delete a task, promoting the next queued one if it was active (`removeTask`). */
  remove: ownerProcedure.input(taskIdInput).mutation(async ({ ctx, input }) => {
    return removeTask(ctx.db, input.id);
  }),

  /** Undo for `remove`: re-inserts the removed row (see restoreTask). */
  restore: ownerProcedure.input(taskRestoreInput).mutation(async ({ ctx, input }) => {
    // A Twitch-shaped author needs no read; only the owner's own non-Twitch key does.
    const chatShaped = isRestorableAuthor(input, { taskId: "", name: "" });
    const owner = chatShaped
      ? null
      : {
          taskId: await resolveOwnerTaskId(ctx.db, ctx.session.user),
          name: ctx.session.user.name,
        };
    if (owner && !isRestorableAuthor(input, owner)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown task author" });
    }
    const restored = await restoreTask(ctx.db, input);
    if (restored || input.status === "done") return restored;
    // Nothing inserted: a double-clicked undo (the id is back already) is a quiet
    // no-op; otherwise the open-task cap refused it.
    const existing = await ctx.db.query.task.findFirst({
      where: (t, { eq }) => eq(t.id, input.id),
      columns: { id: true },
    });
    if (existing) return null;
    throw taskListFull();
  }),

  /** Delete every task (`clearAllTasks`). */
  clearAll: ownerProcedure.mutation(async ({ ctx }) => {
    return clearAllTasks(ctx.db);
  }),

  /** Delete every done task (`clearDoneTasks`). */
  clearDone: ownerProcedure.mutation(async ({ ctx }) => {
    return clearDoneTasks(ctx.db);
  }),
});
