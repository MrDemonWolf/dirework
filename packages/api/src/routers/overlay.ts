import { z } from "zod";

import { publicProcedure, router } from "../index";

export const overlayRouter = router({
  getTimerState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTimerToken: input.token },
        select: { id: true },
      });
      if (!user) return null;

      const [timerState, config] = await Promise.all([
        ctx.prisma.timerState.findUnique({ where: { userId: user.id } }),
        ctx.prisma.config.findUnique({
          where: { userId: user.id },
          select: { timer: true, timerStyles: true },
        }),
      ]);

      return { timerState, config };
    }),

  getTaskList: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { overlayTasksToken: input.token },
        select: { id: true },
      });
      if (!user) return null;

      const [tasks, config] = await Promise.all([
        ctx.prisma.task.findMany({
          where: { ownerId: user.id },
          orderBy: [{ priority: "asc" }, { order: "asc" }],
        }),
        ctx.prisma.config.findUnique({
          where: { userId: user.id },
          select: { taskStyles: true },
        }),
      ]);

      return { tasks, config };
    }),
});
