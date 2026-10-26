// Owner identity + instance-level account actions: the setup gate, the
// dashboard's `me` payload (with the setup checklist flags), setup-step
// confirmation, overlay URL rotation, and bot disconnect.

import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne } from "drizzle-orm";

import { hasOwner } from "@dirework/auth";

import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { missingBotScopes } from "../bot-permissions";
import { ownerProcedure, publicProcedure, router } from "../index";
import { updateSingleton } from "../services/singleton";
import { setStatsTimeZone } from "../services/stats-service";
import { rotateInstanceToken } from "../services/tokens";
import { disconnectBotAccount } from "../services/twitch-auth";
import {
  confirmSetupStepInput,
  regenerateOverlayTokenInput,
  setTimeZoneInput,
  type SetupStep,
} from "./input-schemas";

/**
 * Setup checklist step → the instance_config flag it flips. `satisfies` ties
 * the input enum to real columns, so a step without a column fails type-check.
 */
const SETUP_STEP_COLUMNS = {
  botSource: "setupBotSourceConfirmed",
  timerOverlay: "setupTimerOverlayConfirmed",
  tasksOverlay: "setupTasksOverlayConfirmed",
} as const satisfies Record<SetupStep, keyof typeof schema.instanceConfig.$inferSelect>;

type SetupColumns = Pick<
  typeof schema.instanceConfig.$inferSelect,
  (typeof SETUP_STEP_COLUMNS)[SetupStep]
>;

/** The checklist as the dashboard reads it: one boolean per step, false until the row exists. */
function setupState(instance: SetupColumns | null | undefined): Record<SetupStep, boolean> {
  return {
    botSource: instance?.setupBotSourceConfirmed ?? false,
    timerOverlay: instance?.setupTimerOverlayConfirmed ?? false,
    tasksOverlay: instance?.setupTasksOverlayConfirmed ?? false,
  };
}

/**
 * Milliseconds since a bot page last held the chat lease (claimed or renewed it), or null
 * when none holds it. An age, not a timestamp, so the dashboard compares it against
 * BOT_LEASE_TTL_MS without trusting the browser's clock.
 */
export function botPageSeenMsAgo(seenAt: Date | null | undefined, now: number): number | null {
  return seenAt ? Math.max(0, now - seenAt.getTime()) : null;
}

/**
 * The bot account as the dashboard sees it: public fields, the follower/ban-check scopes an
 * older connection still lacks (Bot settings asks for a reconnect), and whether the bot IS
 * the channel's account (Twitch answers ban lookups only for that one). Never the tokens.
 */
export function publicBotAccount(
  account: {
    username: string;
    displayName: string;
    twitchId: string;
    expiresAt: Date;
    scopes: string[] | null;
  },
  ownerTwitchId: string | null,
) {
  const { scopes, ...rest } = account;
  return {
    ...rest,
    missingScopes: missingBotScopes(scopes),
    isChannelAccount: ownerTwitchId !== null && account.twitchId === ownerTwitchId,
  };
}

export const userRouter = router({
  /**
   * Public setup gate: does this single-tenant instance have an owner yet?
   * Delegates to `hasOwner` in @dirework/auth, the same "any user row" rule the
   * sign-in claim uses; the web app calls it server-side (`lib/server-session.ts`).
   */
  hasOwner: publicProcedure.query(({ ctx }) => hasOwner(ctx.db)),

  /**
   * ownerProcedure. The dashboard's identity payload: the user row, the overlay
   * tokens, the setup checklist flags, the bot account's public fields (never its
   * OAuth tokens), and how long ago a bot page last checked in (the header's "Bot
   * connected" chip). The flags and the check-in come from the instance row this
   * already reads, so they cost no extra statement.
   */
  me: ownerProcedure.query(async ({ ctx }) => {
    const [user, instance, botAccount, twitchAccount] = await Promise.all([
      ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
      }),
      ctx.db.query.instanceConfig.findFirst({
        columns: {
          overlayTimerToken: true,
          overlayTasksToken: true,
          setupBotSourceConfirmed: true,
          setupTimerOverlayConfirmed: true,
          setupTasksOverlayConfirmed: true,
          timeZone: true,
          botLeaseSeenAt: true,
        },
      }),
      // H1 fix: never select accessToken/refreshToken — chat-scoped Twitch
      // credentials must not be serialized to the dashboard. `scopes` is read only to
      // derive `missingScopes` below and is not returned itself.
      ctx.db.query.botAccount.findFirst({
        columns: {
          username: true,
          displayName: true,
          twitchId: true,
          expiresAt: true,
          scopes: true,
        },
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
    const ownerTwitchId = user.twitchId || twitchAccount?.accountId || null;
    // Flatten into same shape as before so frontend needs no changes
    return {
      ...user,
      twitchId: ownerTwitchId,
      botAccount: botAccount ? publicBotAccount(botAccount, ownerTwitchId) : null,
      overlayTimerToken: instance?.overlayTimerToken ?? null,
      overlayTasksToken: instance?.overlayTasksToken ?? null,
      setup: setupState(instance),
      // The zone dashboard stats use (null = UTC); the dashboard reports its own when they differ.
      timeZone: instance?.timeZone ?? null,
      botPageSeenMsAgo: botPageSeenMsAgo(instance?.botLeaseSeenAt, Date.now()),
    };
  }),

  /**
   * ownerProcedure → stats `setStatsTimeZone`. Stores the browser's IANA zone for the
   * dashboard stats' local days. A guarded UPDATE: reporting the zone already stored writes
   * nothing. The dashboard sends it once, only when `me.timeZone` differs from the browser's.
   */
  setTimeZone: ownerProcedure.input(setTimeZoneInput).mutation(async ({ ctx, input }) => {
    const changed = await setStatsTimeZone(ctx.db, input.timeZone);
    return { timeZone: input.timeZone, changed };
  }),

  /**
   * ownerProcedure. Records that the owner confirmed (or un-confirmed) one setup
   * checklist step — "I added it to OBS". Exactly one UPDATE of one column, and
   * only on this click: the flags are never inferred from overlay or bot-page
   * traffic, which would be a write on a poll path. Returns the whole checklist
   * so the dashboard can patch `me` in place instead of refetching it.
   */
  confirmSetupStep: ownerProcedure.input(confirmSetupStepInput).mutation(async ({ ctx, input }) => {
    const column = SETUP_STEP_COLUMNS[input.step];
    const updated = await updateSingleton(ctx.db, schema.instanceConfig, {
      [column]: input.confirmed,
    });
    // The row is provisioned at sign-in, so a miss means the write did not land.
    if (updated?.[column] !== input.confirmed) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save setup step" });
    }
    return { setup: setupState(updated) };
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
   * The same batch clears the "bot page added to OBS" checklist flag (the page
   * can't run without the account); `setup` is the fresh checklist.
   */
  disconnectBot: ownerProcedure.mutation(async ({ ctx }) => {
    const { revoked, setup } = await disconnectBotAccount(ctx.db, {
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    });
    return { success: true, revoked, setup: setupState(setup) };
  }),
});
