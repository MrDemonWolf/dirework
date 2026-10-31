// Helix lookups made with the BOT account's token: whether a viewer follows the channel
// (the "Followers" task access level). ONE Twitch call, time-boxed, and made only when the
// caller has nothing cached.
// Env-free like twitch-auth.ts: callers pass the app credentials.

import { z } from "zod";

import type { DbClient } from "@dirework/db";

import { FOLLOWER_CHECK_SCOPE } from "../bot-permissions";
import { refreshBotToken, TWITCH_FETCH_TIMEOUT_MS, type TwitchCredentials } from "./twitch-auth";

/** Refresh first when the stored token expires within this margin (as getFreshChatToken). */
const HELIX_REFRESH_MARGIN_MS = 60 * 1000;

const twitchIdSchema = z.string().regex(/^\d{1,32}$/);

const followersResponseSchema = z.object({
  data: z.array(z.object({ user_id: twitchIdSchema })).max(100),
});

/** `unavailable`: Twitch couldn't answer (missing scope, not a mod, 429/5xx, timeout). */
export type FollowLookup = "following" | "not-following" | "unavailable";

interface HelixAccess {
  accessToken: string;
  twitchId: string;
  scopes: readonly string[];
}

/**
 * The bot account's token (refreshed when about to expire), id and granted scopes, or
 * "unusable" when `usable` rejects the stored account: decided BEFORE any refresh, so an
 * account that can't make the call never spends a Twitch request. Null: no account, or the
 * refresh failed.
 */
async function botHelixAccess(
  db: DbClient,
  creds: TwitchCredentials,
  usable: (account: Omit<HelixAccess, "accessToken">) => boolean,
): Promise<HelixAccess | "unusable" | null> {
  const row = await db.query.botAccount.findFirst({
    columns: { accessToken: true, expiresAt: true, twitchId: true, scopes: true },
  });
  if (!row) return null;
  const account = {
    accessToken: row.accessToken,
    twitchId: row.twitchId,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
  };
  if (!usable(account)) return "unusable";
  if (row.expiresAt.getTime() - Date.now() > HELIX_REFRESH_MARGIN_MS) return account;
  try {
    const refreshed = await refreshBotToken(db, creds);
    if (!refreshed) return null;
    return {
      accessToken: refreshed.accessToken,
      twitchId: refreshed.twitchId,
      scopes: Array.isArray(refreshed.scopes) ? refreshed.scopes : [],
    };
  } catch {
    return null;
  }
}

/** GET a Helix URL as the bot; the parsed body, or null on any failure. */
async function helixGet<T>(
  url: string,
  access: HelixAccess,
  clientId: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access.accessToken}`, "Client-Id": clientId },
      signal: AbortSignal.timeout(TWITCH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Does `userId` follow `broadcasterId`? Helix Get Channel Followers with `user_id`, which
 * needs FOLLOWER_CHECK_SCOPE and a bot that is the broadcaster or one of its mods. A bot
 * without the scope never calls Twitch. Fails closed: anything but a clean answer is
 * `unavailable`, and the caller refuses the task without caching.
 */
export async function lookupFollow(
  db: DbClient,
  creds: TwitchCredentials,
  ids: { broadcasterId: string; userId: string },
): Promise<FollowLookup> {
  const access = await botHelixAccess(db, creds, (account) =>
    account.scopes.includes(FOLLOWER_CHECK_SCOPE),
  );
  if (!access || access === "unusable") return "unavailable";
  const params = new URLSearchParams({ broadcaster_id: ids.broadcasterId, user_id: ids.userId });
  const body = await helixGet(
    `https://api.twitch.tv/helix/channels/followers?${params}`,
    access,
    creds.clientId,
    followersResponseSchema,
  );
  if (!body) return "unavailable";
  return body.data.some((row) => row.user_id === ids.userId) ? "following" : "not-following";
}
