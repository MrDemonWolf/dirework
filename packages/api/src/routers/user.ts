import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { botService } from "../bot/index";
import * as schema from "@dirework/db/schema";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.user.findFirst({
      where: eq(schema.user.id, ctx.session.user.id),
      with: { botAccount: true },
    });
    return user ?? null;
  }),

  getByOverlayToken: publicProcedure
    .input(z.object({ token: z.string(), type: z.enum(["timer", "tasks"]) }))
    .query(async ({ ctx, input }) => {
      const where = input.type === "timer"
        ? eq(schema.user.overlayTimerToken, input.token)
        : eq(schema.user.overlayTasksToken, input.token);
      const user = await ctx.db.query.user.findFirst({
        where,
        columns: { id: true, name: true },
      });
      return user ?? null;
    }),

  regenerateOverlayToken: protectedProcedure
    .input(z.object({ type: z.enum(["timer", "tasks"]) }))
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomUUID();
      const data = input.type === "timer"
        ? { overlayTimerToken: token }
        : { overlayTasksToken: token };
      await ctx.db.update(schema.user)
        .set(data)
        .where(eq(schema.user.id, ctx.session.user.id));
      return { token };
    }),

  disconnectBot: protectedProcedure.mutation(async ({ ctx }) => {
    // Stop the bot if running
    if (botService.isRunning()) {
      await botService.stop();
    }
    await ctx.db.delete(schema.botAccount)
      .where(eq(schema.botAccount.userId, ctx.session.user.id));
    return { success: true };
  }),
});
