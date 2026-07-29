import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { SINGLETON_ID } from "../config-shared";
import { updateSingleton } from "./singleton";

// How close to expiry (ms) before we proactively refresh the chat token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Refresh-lease timing (P0.5). The lease is held only across the Twitch round
// trip; the wait budget bounds how long a losing caller blocks for the winner.
const REFRESH_LEASE_MS = 15_000;
const REFRESH_WAIT_STEP_MS = 400;
const REFRESH_WAIT_STEPS = 25; // ~10s total

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Every outbound Twitch call is time-boxed (P1.8). Without this, a hung
 * id.twitch.tv/api.twitch.tv response pins the whole Worker request until the
 * platform kills it, and a stalled refresh would hold the refresh lease for its
 * full duration.
 */
export const TWITCH_FETCH_TIMEOUT_MS = 10_000;
const withTimeout = () => AbortSignal.timeout(TWITCH_FETCH_TIMEOUT_MS);

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

type BotAccountRow = typeof schema.botAccount.$inferSelect;

/**
 * Refresh the bot account's Twitch OAuth tokens using the client secret
 * (server-side only) and persist the new tokens. Returns the updated row.
 * The refresh token NEVER leaves the server.
 *
 * Concurrent refreshes are serialized through a coarse DB lease (P0.5): Twitch
 * invalidates the old refresh token when it rotates, so two callers refreshing
 * with the same token would leave one holding a dead token. The winner of the
 * lease CAS hits Twitch; losers wait for it to publish the rotated token and
 * return that, never firing a second refresh with the now-consumed token.
 */
export async function refreshBotToken(
  db: DbClient,
  creds: TwitchCredentials,
): Promise<BotAccountRow | null> {
  const account = await db.query.botAccount.findFirst();
  if (!account) return null;

  const now = Date.now();
  // Acquire the lease: only succeeds if unlocked or the previous lease expired.
  const [leased] = await db
    .update(schema.botAccount)
    .set({ refreshLockedUntil: new Date(now + REFRESH_LEASE_MS) })
    .where(
      and(
        eq(schema.botAccount.id, SINGLETON_ID),
        or(
          isNull(schema.botAccount.refreshLockedUntil),
          lt(schema.botAccount.refreshLockedUntil, new Date(now)),
        ),
      ),
    )
    .returning();

  if (!leased) {
    // Another refresh is in flight — wait for it to publish a rotated token.
    return waitForConcurrentRefresh(db, account.refreshToken);
  }

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
      signal: withTimeout(),
    });

    if (!res.ok) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Twitch token refresh failed — reconnect the bot account",
      });
    }

    const data = (await res.json()) as TwitchTokenResponse;

    const [updated] = await db
      .update(schema.botAccount)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? account.refreshToken,
        expiresAt:
          data.expires_in != null
            ? new Date(Date.now() + data.expires_in * 1000)
            : account.expiresAt,
        scopes: data.scope ?? account.scopes,
        refreshLockedUntil: null, // release the lease
      })
      .where(eq(schema.botAccount.id, SINGLETON_ID))
      .returning();
    return updated ?? null;
  } catch (err) {
    // Release the lease so a later attempt isn't blocked by our failure.
    await releaseRefreshLease(db);
    throw err;
  }
}

/** Clear the refresh lease (best-effort — never throws over a failed refresh). */
async function releaseRefreshLease(db: DbClient): Promise<void> {
  try {
    await db
      .update(schema.botAccount)
      .set({ refreshLockedUntil: null })
      .where(eq(schema.botAccount.id, SINGLETON_ID));
  } catch {
    // Lease expires on its own (REFRESH_LEASE_MS); swallowing is safe.
  }
}

/**
 * Poll until the lease-holding refresh publishes a rotated refresh token, then
 * return the fresh row. Falls back to the current row if the wait budget is
 * exhausted (the holder crashed and its lease will expire, letting the next
 * caller retry the refresh itself).
 */
async function waitForConcurrentRefresh(
  db: DbClient,
  priorRefreshToken: string,
): Promise<BotAccountRow | null> {
  for (let i = 0; i < REFRESH_WAIT_STEPS; i++) {
    await sleep(REFRESH_WAIT_STEP_MS);
    const row = await db.query.botAccount.findFirst();
    if (!row) return null;
    if (row.refreshLockedUntil == null && row.refreshToken !== priorRefreshToken) {
      return row; // winner published a rotated token
    }
  }
  return (await db.query.botAccount.findFirst()) ?? null;
}

/**
 * Validate a bot access token against Twitch's /oauth2/validate endpoint.
 * Returns true if Twitch still honors it, false on a 401 (revoked, password
 * change, disconnected). Any other/transient error returns true so we don't
 * force an unnecessary refresh on a network blip.
 */
export async function validateChatToken(token: string): Promise<boolean> {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${token}` },
      signal: withTimeout(),
    });
    if (res.status === 401) return false;
    return true;
  } catch {
    return true;
  }
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
 *
 * `revalidate` (the hourly liveness tick) validates a still-unexpired token
 * against Twitch and refreshes only if Twitch no longer honors it — catching a
 * revoked-but-unexpired token without an IRC round trip.
 */
export async function getFreshChatToken(
  db: DbClient,
  creds: TwitchCredentials,
  opts: { forceRefresh?: boolean; revalidate?: boolean } = {},
): Promise<string | null> {
  const account = await db.query.botAccount.findFirst({
    columns: { accessToken: true, expiresAt: true },
  });
  if (!account) return null;

  const nearExpiry = account.expiresAt.getTime() - Date.now() <= REFRESH_MARGIN_MS;

  if (opts.forceRefresh || nearExpiry) {
    const refreshed = await refreshBotToken(db, creds);
    return refreshed?.accessToken ?? null;
  }

  if (opts.revalidate && !(await validateChatToken(account.accessToken))) {
    const refreshed = await refreshBotToken(db, creds);
    return refreshed?.accessToken ?? null;
  }

  return account.accessToken;
}

/**
 * Disconnect the bot account: best-effort revoke the access token at Twitch,
 * then delete the singleton row. Revocation failures never block deletion.
 */
export async function disconnectBotAccount(db: DbClient, creds: TwitchCredentials): Promise<void> {
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
        signal: withTimeout(),
      });
    } catch {
      // Best-effort revocation — proceed with deletion even if revocation fails
    }
  }

  await db.delete(schema.botAccount).where(eq(schema.botAccount.id, SINGLETON_ID));
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
          signal: withTimeout(),
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
