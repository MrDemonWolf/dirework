// ── Bot account scopes, "Who can add tasks", and ban cleanup timing ───────────
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
 * `moderation:read` lets the bot ask Twitch whether a viewer is still banned before ban
 * cleanup removes their tasks (Helix Get Banned Users). Twitch answers that endpoint ONLY
 * for the broadcaster's own token, so the check runs only when the bot account IS the
 * channel's account; a separate bot account (the usual setup) falls back to removing.
 */
export const BAN_CHECK_SCOPE = "moderation:read";

/**
 * Scopes the bot OAuth flow requests (apps/server routes/bot-oauth.ts).
 * chat:read / chat:edit — the IRC connection the browser bot page uses.
 * user:read:chat / user:write:chat — Helix/EventSub chat scopes, kept so a future move to
 * Helix sends needs no reconnect.
 * FOLLOWER_CHECK_SCOPE / BAN_CHECK_SCOPE — above. A bot connected before they were added
 * keeps working; only the follower and ban checks need one reconnect.
 * user:bot is deliberately not requested: only a server-side (EventSub) bot would use it.
 */
export const BOT_SCOPES = [
  "chat:read",
  "chat:edit",
  "user:read:chat",
  "user:write:chat",
  FOLLOWER_CHECK_SCOPE,
  BAN_CHECK_SCOPE,
] as const;

/** How long the bot page waits after a permanent ban before removing the viewer's tasks. */
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
  return [FOLLOWER_CHECK_SCOPE, BAN_CHECK_SCOPE].filter((scope) => !have.has(scope));
}
