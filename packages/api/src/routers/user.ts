// Owner identity + instance-level account actions: the setup gate, the
// dashboard's `me` payload, overlay URL rotation, and bot disconnect.

import { and, asc, count, eq, ne } from "drizzle-orm";

import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { ownerProcedure, publicProcedure, router } from "../index";
import { rotateInstanceToken } from "../services/tokens";
import { disconnectBotAccount } from "../services/twitch-auth";
import { regenerateOverlayTokenInput } from "./input-schemas";

export const userRouter = router({
  /**
   * Public setup gate: does this single-tenant instance have an owner yet?
   * Same "any user row" rule as `hasOwner` in @dirework/auth; the web app calls
   * it server-side (`lib/server-session.ts`).
   */
  hasOwner: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select({ count: count() }).from(schema.user);
    return (row?.count ?? 0) > 0;
  }),

  /**
   * ownerProcedure. The dashboard's identity payload: the user row, the overlay
   * tokens, and the bot account's public fields (never its OAuth tokens).
   */
  me: ownerProcedure.query(async ({ ctx }) => {
    const [user, instance, botAccount, twitchAccount] = await Promise.all([
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
      // Fallback Twitch ID from the provider account, for owner rows whose
      // twitchId column is empty (same lookup as resolveOwnerTwitchId).
      ctx.db.query.account.findFirst({
        where: and(
          eq(schema.account.userId, ctx.session.user.id),
          eq(schema.account.providerId, "twitch"),
          ne(schema.account.accountId, ""),
        ),
        orderBy: [asc(schema.account.createdAt), asc(schema.account.id)],
        columns: { accountId: true },
      }),
    ]);
    if (!user) return null;
    // Flatten into same shape as before so frontend needs no changes
    return {
      ...user,
      twitchId: user.twitchId || twitchAccount?.accountId || null,
      botAccount: botAccount ?? null,
      overlayTimerToken: instance?.overlayTimerToken ?? null,
      overlayTasksToken: instance?.overlayTasksToken ?? null,
    };
  }),

  /**
   * ownerProcedure → tokens `rotateInstanceToken`. Issues a new timer or tasks
   * overlay token, so any previously copied OBS URL stops working.
   */
  regenerateOverlayToken: ownerProcedure
    .input(regenerateOverlayTokenInput)
    .mutation(async ({ ctx, input }) => {
      const token = await rotateInstanceToken(
        ctx.db,
        input.type === "timer" ? "overlayTimerToken" : "overlayTasksToken",
      );
      return { token };
    }),

  /**
   * ownerProcedure → twitch-auth `disconnectBotAccount`. Deletes the bot account
   * even when Twitch revocation fails; `revoked` reports whether Twitch confirmed it.
   */
  disconnectBot: ownerProcedure.mutation(async ({ ctx }) => {
    const { revoked } = await disconnectBotAccount(ctx.db, {
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    });
    return { success: true, revoked };
  }),
});
