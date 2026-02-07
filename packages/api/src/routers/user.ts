import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: { botAccount: true },
    });
    return user;
  }),

  getByOverlayToken: publicProcedure
    .input(z.object({ token: z.string(), type: z.enum(["timer", "tasks"]) }))
    .query(async ({ ctx, input }) => {
      const where =
        input.type === "timer"
          ? { overlayTimerToken: input.token }
          : { overlayTasksToken: input.token };
      const user = await ctx.prisma.user.findFirst({ where, select: { id: true, name: true } });
      return user;
    }),

  regenerateOverlayToken: protectedProcedure
    .input(z.object({ type: z.enum(["timer", "tasks"]) }))
    .mutation(async ({ ctx, input }) => {
      const field =
        input.type === "timer" ? "overlayTimerToken" : "overlayTasksToken";
      const token = crypto.randomUUID();
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { [field]: token },
      });
      return { token };
    }),

  disconnectBot: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.botAccount.deleteMany({
      where: { userId: ctx.session.user.id },
    });
    return { success: true };
  }),
});
