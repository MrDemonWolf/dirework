import { count, eq } from "drizzle-orm";
import { z } from "zod";

import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { protectedProcedure, publicProcedure, router } from "../index";
import { updateSingleton } from "../services/singleton";

export const userRouter = router({
  /** Public setup gate: does this single-tenant instance have an owner yet? */
  hasOwner: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select({ count: count() }).from(schema.user);
    return (row?.count ?? 0) > 0;
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user, instance, botAccount] = await Promise.all([
      ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
      }),
      ctx.db.query.instanceConfig.findFirst({
        columns: { overlayTimerToken: true, overlayTasksToken: true },
      }),
      // H1 fix: never select accessToken/refreshToken/scopes — chat-scoped
      // Twitch credentials must not be serialized to the dashboard.
      ctx.db.query.botAccount.findFirst({
        columns: { username: true, displayName: true, twitchId: true, expiresAt: true },
      }),
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
      const set = input.type === "timer"
        ? { overlayTimerToken: token }
        : { overlayTasksToken: token };
      await updateSingleton(ctx.db, schema.instanceConfig, set);
      return { token };
    }),

  disconnectBot: protectedProcedure.mutation(async ({ ctx }) => {
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
