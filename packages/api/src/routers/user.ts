import { count, eq } from "drizzle-orm";

import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { ownerProcedure, publicProcedure, router } from "../index";
import { updateSingleton } from "../services/singleton";
import { disconnectBotAccount } from "../services/twitch-auth";
import { regenerateOverlayTokenInput } from "./input-schemas";

export const userRouter = router({
  /** Public setup gate: does this single-tenant instance have an owner yet? */
  hasOwner: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select({ count: count() }).from(schema.user);
    return (row?.count ?? 0) > 0;
  }),

  me: ownerProcedure.query(async ({ ctx }) => {
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

  regenerateOverlayToken: ownerProcedure
    .input(regenerateOverlayTokenInput)
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomUUID();
      const set = input.type === "timer"
        ? { overlayTimerToken: token }
        : { overlayTasksToken: token };
      await updateSingleton(ctx.db, schema.instanceConfig, set);
      return { token };
    }),

  disconnectBot: ownerProcedure.mutation(async ({ ctx }) => {
    await disconnectBotAccount(ctx.db, {
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    });
    return { success: true };
  }),
});
