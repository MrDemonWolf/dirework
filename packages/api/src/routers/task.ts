import { TRPCError } from "@trpc/server";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee, TASK_LIST_CHANGE } from "../events";
import * as schema from "@dirework/db/schema";

export const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.task.findMany({
      orderBy: [asc(schema.task.priority), asc(schema.task.order)],
    });
  }),

  listByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.db.query.instanceConfig.findFirst({
        columns: { overlayTasksToken: true },
      });
      if (!instance || instance.overlayTasksToken !== input.token) return [];
      return ctx.db.query.task.findMany({
        orderBy: [asc(schema.task.priority), asc(schema.task.order)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        authorTwitchId: z.string(),
        authorUsername: z.string(),
        authorDisplayName: z.string(),
        authorColor: z.string().optional(),
        text: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db.query.user.findFirst({
        columns: { twitchId: true },
      });
      const isBroadcaster = owner?.twitchId === input.authorTwitchId;

      const [lastTask, existingTasks] = await Promise.all([
        ctx.db.query.task.findFirst({
          where: eq(schema.task.priority, isBroadcaster ? 0 : 1),
          orderBy: [desc(schema.task.order)],
          columns: { order: true },
        }),
        ctx.db.query.task.findMany({
          where: and(
            eq(schema.task.authorTwitchId, input.authorTwitchId),
            inArray(schema.task.status, ["pending", "active"]),
          ),
          columns: { id: true },
        }),
      ]);

      const autoActivate = existingTasks.length === 0;

      const [result] = await ctx.db.insert(schema.task).values({
        ...input,
        status: autoActivate ? "active" : "pending",
        priority: isBroadcaster ? 0 : 1,
        order: (lastTask?.order ?? 0) + 1,
      }).returning();
      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.task.findFirst({
        where: eq(schema.task.id, input.id),
        columns: { id: true, status: true, authorTwitchId: true },
      });
      if (!existing) return null;

      const wasActive = existing.status === "active";

      const [result] = await ctx.db.update(schema.task)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(schema.task.id, existing.id))
        .returning();
      if (!result) return null;

      if (wasActive) {
        const nextPending = await ctx.db.query.task.findFirst({
          where: and(
            eq(schema.task.authorTwitchId, result.authorTwitchId),
            eq(schema.task.status, "pending"),
          ),
          orderBy: [asc(schema.task.order)],
        });
        if (nextPending) {
          await ctx.db.update(schema.task)
            .set({ status: "active" })
            .where(eq(schema.task.id, nextPending.id));
        }
      }

      ee.emit(TASK_LIST_CHANGE);
      return result;
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.task.findFirst({
        where: eq(schema.task.id, input.id),
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      if (task.status === "done") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot activate a completed task" });
      }

      await ctx.db.update(schema.task)
        .set({ status: "pending" })
        .where(and(
          eq(schema.task.authorTwitchId, task.authorTwitchId),
          eq(schema.task.status, "active"),
        ));

      const [result] = await ctx.db.update(schema.task)
        .set({ status: "active" })
        .where(eq(schema.task.id, task.id))
        .returning();

      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.update(schema.task)
        .set({ text: input.text })
        .where(eq(schema.task.id, input.id))
        .returning();
      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.delete(schema.task)
        .where(eq(schema.task.id, input.id))
        .returning();
      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  // ── Broadcaster moderation ────────────────────────────────

  removeByViewer: protectedProcedure
    .input(z.object({ authorTwitchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.delete(schema.task)
        .where(eq(schema.task.authorTwitchId, input.authorTwitchId));
      ee.emit(TASK_LIST_CHANGE);
      return result;
    }),

  moderateEdit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.update(schema.task)
        .set({ text: input.text })
        .where(eq(schema.task.id, input.id))
        .returning();
      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  moderateRemove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.delete(schema.task)
        .where(eq(schema.task.id, input.id))
        .returning();
      ee.emit(TASK_LIST_CHANGE);
      return result ?? null;
    }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task);
    ee.emit(TASK_LIST_CHANGE);
    return result;
  }),

  clearDone: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task)
      .where(eq(schema.task.status, "done"));
    ee.emit(TASK_LIST_CHANGE);
    return result;
  }),

  clearViewers: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task)
      .where(eq(schema.task.priority, 1));
    ee.emit(TASK_LIST_CHANGE);
    return result;
  }),
});
