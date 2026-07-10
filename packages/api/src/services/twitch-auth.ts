import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { SINGLETON_ID } from "../config-shared";
import { updateSingleton } from "./singleton";

// How close to expiry (ms) before we proactively refresh the chat token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Twitch app credentials, passed in by callers that can read env (routers,
 * Hono routes). This service stays env-free so Vitest can import it in Node
 * (`cloudflare:workers` does not resolve outside the Workers runtime).
 */
export interface TwitchCredentials {
  clientId: string;
  clientSecret: string;
}

interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string[];
}

/**
 * Refresh the bot account's Twitch OAuth tokens using the client secret
 * (server-side only) and persist the new tokens. Returns the updated row.
 * The refresh token NEVER leaves the server.
 */
export async function refreshBotToken(db: DbClient, creds: TwitchCredentials) {
  const account = await db.query.botAccount.findFirst();
  if (!account) return null;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Twitch token refresh failed — reconnect the bot account",
    });
  }

  const data = (await res.json()) as TwitchTokenResponse;

  const [updated] = await db.update(schema.botAccount)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? account.refreshToken,
      expiresAt: data.expires_in != null
        ? new Date(Date.now() + data.expires_in * 1000)
        : account.expiresAt,
      scopes: data.scope ?? account.scopes,
    })
    .where(eq(schema.botAccount.id, SINGLETON_ID))
    .returning();
  return updated ?? null;
}

/**
 * Return a chat access token that is valid for at least REFRESH_MARGIN_MS,
 * refreshing first when it is near or past expiry. Returns null when no bot
 * account is connected.
 *
 * `forceRefresh` skips the expiry check and always runs the refresh flow —
 * the recovery path after Twitch rejects a stored token (IRC 401): the DB
 * copy may look fresh by its timestamp but is dead server-side (password
 * change, disconnect from Twitch settings, revocation).
 */
export async function getFreshChatToken(
  db: DbClient,
  creds: TwitchCredentials,
  opts: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  const account = await db.query.botAccount.findFirst({
    columns: { accessToken: true, expiresAt: true },
  });
  if (!account) return null;

  if (!opts.forceRefresh && account.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return account.accessToken;
  }

  const refreshed = await refreshBotToken(db, creds);
  return refreshed?.accessToken ?? null;
}

/**
 * Disconnect the bot account: best-effort revoke the access token at Twitch,
 * then delete the singleton row. Revocation failures never block deletion.
 */
export async function disconnectBotAccount(
  db: DbClient,
  creds: TwitchCredentials,
): Promise<void> {
  const account = await db.query.botAccount.findFirst({
    columns: { accessToken: true },
  });

  if (account?.accessToken) {
    try {
      await fetch("https://id.twitch.tv/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          token: account.accessToken,
        }),
      });
    } catch {
      // Best-effort revocation — proceed with deletion even if revocation fails
    }
  }

  await db.delete(schema.botAccount);
}

/**
 * Resolve the IRC channel to JOIN: Twitch IRC requires the lowercase *login*
 * name, but better-auth only stores the display name (capitals, spaces or
 * localized names break JOIN). Uses the cached `instanceConfig.channelLogin`
 * when present; otherwise looks the login up via Helix `GET /users?id=` with
 * the bot's chat token and persists it. Falls back to the lowercased display
 * name when the lookup is impossible (no twitchId — e.g. dev login) or fails.
 */
export async function resolveChannelLogin(
  db: DbClient,
  helix: { clientId: string; accessToken: string },
  owner: { twitchId: string | null; fallbackName: string },
): Promise<string> {
  const instance = await db.query.instanceConfig.findFirst({
    columns: { channelLogin: true },
  });
  if (instance?.channelLogin) return instance.channelLogin;

  if (owner.twitchId) {
    try {
      const res = await fetch(
        `https://api.twitch.tv/helix/users?id=${encodeURIComponent(owner.twitchId)}`,
        {
          headers: {
            Authorization: `Bearer ${helix.accessToken}`,
            "Client-Id": helix.clientId,
          },
        },
      );
      if (res.ok) {
        const body = (await res.json()) as { data?: { login?: string }[] };
        const login = body.data?.[0]?.login;
        if (login) {
          await updateSingleton(db, schema.instanceConfig, { channelLogin: login });
          return login;
        }
      }
    } catch {
      // Helix unreachable — fall through to the display-name fallback.
    }
  }

  return owner.fallbackName.toLowerCase();
}
