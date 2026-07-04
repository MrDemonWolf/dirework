import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { SINGLETON_ID } from "../config-shared";

// How close to expiry (ms) before we proactively refresh the chat token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

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
export async function refreshBotToken(db: DbClient) {
  const account = await db.query.botAccount.findFirst();
  if (!account) return null;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
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
 */
export async function getFreshChatToken(db: DbClient): Promise<string | null> {
  const account = await db.query.botAccount.findFirst({
    columns: { accessToken: true, expiresAt: true },
  });
  if (!account) return null;

  if (account.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return account.accessToken;
  }

  const refreshed = await refreshBotToken(db);
  return refreshed?.accessToken ?? null;
}
