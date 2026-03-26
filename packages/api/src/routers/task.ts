import { TRPCError } from "@trpc/server";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee } from "../events";
import * as schema from "@dirework/db/schema";

export const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.task.findMany({
      where: eq(schema.task.ownerId, ctx.session.user.id),
      orderBy: [asc(schema.task.priority), asc(schema.task.order)],
    });
  }),

  listByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.overlayTasksToken, input.token),
        columns: { id: true },
      });
      if (!user) return [];
      return ctx.db.query.task.findMany({
        where: eq(schema.task.ownerId, user.id),
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
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
        columns: { twitchId: true },
      });
      const isBroadcaster = user?.twitchId === input.authorTwitchId;

      const [lastTask, existingTasks] = await Promise.all([
        ctx.db.query.task.findFirst({
          where: and(
            eq(schema.task.ownerId, ctx.session.user.id),
            eq(schema.task.priority, isBroadcaster ? 0 : 1),
          ),
          orderBy: [desc(schema.task.order)],
          columns: { order: true },
        }),
        ctx.db.query.task.findMany({
          where: and(
            eq(schema.task.ownerId, ctx.session.user.id),
            eq(schema.task.authorTwitchId, input.authorTwitchId),
            inArray(schema.task.status, ["pending", "active"]),
          ),
          columns: { id: true },
        }),
      ]);

      const autoActivate = existingTasks.length === 0;

      const [result] = await ctx.db.insert(schema.task).values({
        ownerId: ctx.session.user.id,
        ...input,
        status: autoActivate ? "active" : "pending",
        priority: isBroadcaster ? 0 : 1,
        order: (lastTask?.order ?? 0) + 1,
      }).returning();
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch current status before updating
      const existing = await ctx.db.query.task.findFirst({
        where: and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)),
        columns: { id: true, status: true, authorTwitchId: true },
      });
      if (!existing) return null;

      const wasActive = existing.status === "active";

      const [result] = await ctx.db.update(schema.task)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(schema.task.id, existing.id))
        .returning();
      if (!result) return null;

      // Only promote next pending task if the completed task was active
      if (wasActive) {
        const nextPending = await ctx.db.query.task.findFirst({
          where: and(
            eq(schema.task.ownerId, ctx.session.user.id),
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

      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.task.findFirst({
        where: and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)),
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      if (task.status === "done") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot activate a completed task" });
      }

      // Demote current active task for the same author back to pending
      await ctx.db.update(schema.task)
        .set({ status: "pending" })
        .where(and(
          eq(schema.task.ownerId, ctx.session.user.id),
          eq(schema.task.authorTwitchId, task.authorTwitchId),
          eq(schema.task.status, "active"),
        ));

      const [result] = await ctx.db.update(schema.task)
        .set({ status: "active" })
        .where(eq(schema.task.id, task.id))
        .returning();

      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.update(schema.task)
        .set({ text: input.text })
        .where(and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)))
        .returning();
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.delete(schema.task)
        .where(and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)))
        .returning();
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  // ── Broadcaster moderation ────────────────────────────────

  /** Remove all tasks from a specific viewer */
  removeByViewer: protectedProcedure
    .input(z.object({ authorTwitchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.delete(schema.task)
        .where(and(
          eq(schema.task.ownerId, ctx.session.user.id),
          eq(schema.task.authorTwitchId, input.authorTwitchId),
        ));
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  /** Edit any task (broadcaster moderation) */
  moderateEdit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.update(schema.task)
        .set({ text: input.text })
        .where(and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)))
        .returning();
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  /** Delete any task (broadcaster moderation) */
  moderateRemove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.delete(schema.task)
        .where(and(eq(schema.task.id, input.id), eq(schema.task.ownerId, ctx.session.user.id)))
        .returning();
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result ?? null;
    }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task)
      .where(eq(schema.task.ownerId, ctx.session.user.id));
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),

  clearDone: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task)
      .where(and(eq(schema.task.ownerId, ctx.session.user.id), eq(schema.task.status, "done")));
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),

  /** Clear only viewer tasks, keep broadcaster's own tasks */
  clearViewers: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.delete(schema.task)
      .where(and(eq(schema.task.ownerId, ctx.session.user.id), eq(schema.task.priority, 1)));
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),
});
