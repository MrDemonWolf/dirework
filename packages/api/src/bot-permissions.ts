// ── Bot account scopes and OAuth errors, "Who can add tasks", ban cleanup timing ──
// Zod-free and schema-free: the bot page, the dashboard and the api worker all read these.

import {
  DEFAULT_TASK_ACCESS,
  TASK_ACCESS_LEVELS,
  type TaskAccessLevel,
} from "@dirework/db/defaults";

export { DEFAULT_TASK_ACCESS, TASK_ACCESS_LEVELS, type TaskAccessLevel };

/**
 * `moderator:read:followers` lets the bot ask Twitch whether a viewer follows the channel
 * (Helix Get Channel Followers with `user_id`). Twitch answers it only for the broadcaster
 * or one of the channel's moderators, so the bot account must be a mod.
 */
export const FOLLOWER_CHECK_SCOPE = "moderator:read:followers";

/**
 * Scopes the bot OAuth flow requests (apps/server routes/bot-oauth.ts).
 * chat:read / chat:edit — the IRC connection the browser bot page uses.
 * user:read:chat / user:write:chat — Helix/EventSub chat scopes, kept so a future move to
 * Helix sends needs no reconnect.
 * FOLLOWER_CHECK_SCOPE — above. A bot connected before it was added keeps working; only
 * the Followers level needs one reconnect.
 * No moderation scope: ban cleanup needs none (Twitch answers Get Banned Users only for the
 * broadcaster's own token, so a separate bot account could never use one).
 * user:bot is deliberately not requested: only a server-side (EventSub) bot would use it.
 */
export const BOT_SCOPES = [
  "chat:read",
  "chat:edit",
  "user:read:chat",
  "user:write:chat",
  FOLLOWER_CHECK_SCOPE,
] as const;

// The bot OAuth callback redirects to `/dashboard/bot?bot=error&reason=<code>`.
// The dashboard maps the code to fixed copy and never renders the raw query
// param, so a crafted link can't put attacker-written text in an error toast.
export const BOT_OAUTH_ERROR_MESSAGES = {
  access_denied: "Twitch authorization was cancelled.",
  missing_params: "Twitch didn't return an authorization code.",
  authorization_failed:
    "Twitch refused the authorization request. Check the app's Client ID and redirect URL.",
  invalid_state: "The OAuth state was invalid.",
  state_mismatch: "The OAuth request expired.",
  session_mismatch: "Your session expired or changed during sign-in.",
  token_unavailable: "Twitch's token service didn't respond.",
  token_exchange_failed: "Twitch rejected the token exchange. Check the app's redirect URL.",
  invalid_token_response: "Twitch returned an invalid token response.",
  user_unavailable: "Twitch's user service didn't respond.",
  user_lookup_failed: "Couldn't look up the bot account on Twitch.",
  invalid_user_response: "Twitch returned no valid user data.",
  db_error: "The bot account couldn't be saved.",
} as const;

export type BotOAuthErrorCode = keyof typeof BOT_OAUTH_ERROR_MESSAGES;

/** Fixed toast copy for a `?reason=` code; unknown or missing codes get a generic message. */
export function botOAuthErrorMessage(code: string | null | undefined): string {
  const detail =
    code && Object.hasOwn(BOT_OAUTH_ERROR_MESSAGES, code)
      ? BOT_OAUTH_ERROR_MESSAGES[code as BotOAuthErrorCode]
      : "Something went wrong.";
  return `Couldn't connect the bot account. ${detail} Try again.`;
}

/**
 * How long the bot page waits after a permanent ban before removing the viewer's tasks. The
 * viewer chatting again (unbanned) or a timeout replacing the ban cancels it.
 */
export const BAN_CLEANUP_DELAY_MS = 5 * 60 * 1000;

/** What a chatter's IRC badges say about them (the bot page forwards these). */
export interface ChatterStanding {
  isBroadcaster: boolean;
  isMod: boolean;
  isVip: boolean;
  isSubscriber: boolean;
}

/**
 * Whether a chatter may add tasks at `level`. "check-follow" means only a follow would let
 * them in, which only Twitch can answer. Each level admits everyone above it, and the
 * broadcaster and mods always pass.
 */
export function taskAccessVerdict(
  level: TaskAccessLevel,
  who: ChatterStanding,
): "allowed" | "check-follow" | "denied" {
  if (level === "everyone" || who.isBroadcaster || who.isMod) return "allowed";
  if (who.isVip) return "allowed";
  if (level === "vips") return "denied";
  if (who.isSubscriber) return "allowed";
  return level === "followers" ? "check-follow" : "denied";
}

/** A stored task_access value, with anything unknown read as the default. */
export function readTaskAccess(stored: unknown): TaskAccessLevel {
  return (TASK_ACCESS_LEVELS as readonly unknown[]).includes(stored)
    ? (stored as TaskAccessLevel)
    : DEFAULT_TASK_ACCESS;
}

/** The new scopes a stored bot account still lacks (an older connection), in BOT_SCOPES order. */
export function missingBotScopes(granted: readonly string[] | null | undefined): string[] {
  const have = new Set(granted ?? []);
  return [FOLLOWER_CHECK_SCOPE].filter((scope) => !have.has(scope));
}
