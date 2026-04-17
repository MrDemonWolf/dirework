import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { botService } from "../bot/index";
import { env } from "@dirework/env/server";
import * as schema from "@dirework/db/schema";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user, instance, botAccount] = await Promise.all([
      ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
      }),
      ctx.db.query.instanceConfig.findFirst({
        columns: { overlayTimerToken: true, overlayTasksToken: true },
      }),
      ctx.db.query.botAccount.findFirst(),
    ]);
    if (!user) return null;
    // Flatten into same shape as before so frontend needs no changes
    return {
      ...user,
      botAccount: botAccount ?? null,
      overlayTimerToken: instance?.overlayTimerToken ?? null,
      overlayTasksToken: instance?.overlayTasksToken ?? null,
    };
  }),

  regenerateOverlayToken: protectedProcedure
    .input(z.object({ type: z.enum(["timer", "tasks"]) }))
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomUUID();
      const data = input.type === "timer"
        ? { overlayTimerToken: token }
        : { overlayTasksToken: token };
      await ctx.db.insert(schema.instanceConfig)
        .values({ ...data })
        .onConflictDoUpdate({ target: schema.instanceConfig.id, set: data });
      return { token };
    }),

  disconnectBot: protectedProcedure.mutation(async ({ ctx }) => {
    if (botService.isRunning()) {
      await botService.stop();
    }

    const botAccount = await ctx.db.query.botAccount.findFirst({
      columns: { accessToken: true },
    });

    if (botAccount?.accessToken) {
      try {
        await fetch("https://id.twitch.tv/oauth2/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.TWITCH_CLIENT_ID,
            token: botAccount.accessToken,
          }),
        });
      } catch {
        // Best-effort revocation — proceed with deletion even if revocation fails
      }
    }

    await ctx.db.delete(schema.botAccount);
    return { success: true };
  }),
});
