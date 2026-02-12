import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { ee } from "../events";

export const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.task.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: [{ priority: "asc" }, { order: "asc" }],
    });
  }),

  listByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTasksToken: input.token },
        select: { id: true },
      });
      if (!user) return [];
      return ctx.prisma.task.findMany({
        where: { ownerId: user.id },
        orderBy: [{ priority: "asc" }, { order: "asc" }],
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
      // Check if the author is the broadcaster (owner)
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { twitchId: true },
      });
      const isBroadcaster = user?.twitchId === input.authorTwitchId;

      const lastTask = await ctx.prisma.task.findFirst({
        where: {
          ownerId: ctx.session.user.id,
          priority: isBroadcaster ? 0 : 1,
        },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const result = await ctx.prisma.task.create({
        data: {
          ownerId: ctx.session.user.id,
          ...input,
          priority: isBroadcaster ? 0 : 1,
          order: (lastTask?.order ?? 0) + 1,
        },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.update({
        where: { id: input.id, ownerId: ctx.session.user.id },
        data: { status: "done", completedAt: new Date() },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.update({
        where: { id: input.id, ownerId: ctx.session.user.id },
        data: { text: input.text },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.delete({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  // ── Broadcaster moderation ────────────────────────────────

  /** Remove all tasks from a specific viewer */
  removeByViewer: protectedProcedure
    .input(z.object({ authorTwitchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.deleteMany({
        where: {
          ownerId: ctx.session.user.id,
          authorTwitchId: input.authorTwitchId,
        },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  /** Edit any task (broadcaster moderation) */
  moderateEdit: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.update({
        where: { id: input.id, ownerId: ctx.session.user.id },
        data: { text: input.text },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  /** Delete any task (broadcaster moderation) */
  moderateRemove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.task.delete({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      ee.emit(`taskListChange:${ctx.session.user.id}`);
      return result;
    }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.task.deleteMany({
      where: { ownerId: ctx.session.user.id },
    });
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),

  clearDone: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.task.deleteMany({
      where: { ownerId: ctx.session.user.id, status: "done" },
    });
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),

  /** Clear only viewer tasks, keep broadcaster's own tasks */
  clearViewers: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.task.deleteMany({
      where: { ownerId: ctx.session.user.id, priority: 1 },
    });
    ee.emit(`taskListChange:${ctx.session.user.id}`);
    return result;
  }),
});
