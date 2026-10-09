import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { BOT_REAUTH_REQUIRED_MESSAGE, hasControlCharacters, SINGLETON_ID } from "../config-shared";
import { updateSingleton } from "./singleton";

// How close to expiry (ms) before we proactively refresh the chat token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Refresh-lease timing. The lease is held only across the Twitch round
// trip; the wait budget bounds how long a losing caller blocks for the winner.
const REFRESH_LEASE_MS = 15_000;
const REFRESH_WAIT_STEP_MS = 400;
const REFRESH_WAIT_STEPS = 25; // ~10s total

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Every outbound Twitch call is time-boxed. Without this, a hung
 * id.twitch.tv/api.twitch.tv response pins the whole Worker request until the
 * platform kills it, and a stalled refresh would hold the refresh lease for its
 * full duration.
 */
export const TWITCH_FETCH_TIMEOUT_MS = 10_000;
const withTimeout = () => AbortSignal.timeout(TWITCH_FETCH_TIMEOUT_MS);

export { BOT_REAUTH_REQUIRED_MESSAGE };

/**
 * Twitch app credentials, passed in by callers that can read env (routers,
 * Hono routes). This service stays env-free so Vitest can import it in Node
 * (`cloudflare:workers` does not resolve outside the Workers runtime).
 */
export interface TwitchCredentials {
  clientId: string;
  clientSecret: string;
}

const protocolTokenSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => !hasControlCharacters(value));
const twitchLoginSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{1,25}$/i);
const twitchRefreshResponseSchema = z
  .object({
    access_token: protocolTokenSchema,
    refresh_token: protocolTokenSchema.optional(),
    expires_in: z
      .number()
      .int()
      .min(1)
      .max(366 * 24 * 60 * 60)
      .optional(),
    scope: z
      .array(
        z
          .string()
          .min(1)
          .max(128)
          .refine((value) => !hasControlCharacters(value)),
      )
      .max(32)
      .optional(),
    token_type: z.string().max(32).optional(),
  })
  .refine((value) => value.token_type === undefined || value.token_type.toLowerCase() === "bearer");
const helixLoginResponseSchema = z.object({
  data: z
    .array(z.object({ login: twitchLoginSchema }))
    .min(1)
    .max(100),
});

type BotAccountRow = typeof schema.botAccount.$inferSelect;

/**
 * Refresh the bot account's Twitch OAuth tokens using the client secret
 * (server-side only) and persist the new tokens. Returns the updated row.
 * The refresh token NEVER leaves the server.
 *
 * Concurrent refreshes are serialized through a coarse DB lease: Twitch
 * invalidates the old refresh token when it rotates, so two callers refreshing
 * with the same token would leave one holding a dead token. The winner of the
 * lease CAS hits Twitch; losers wait for it to publish the rotated token and
 * return that, never firing a second refresh with the now-consumed token.
 */
export async function refreshBotToken(
  db: DbClient,
  creds: TwitchCredentials,
): Promise<BotAccountRow | null> {
  return refreshWithLease(db, creds, { waitOnContention: true });
}

async function refreshWithLease(
  db: DbClient,
  creds: TwitchCredentials,
  opts: { waitOnContention: boolean },
): Promise<BotAccountRow | null> {
  const account = await db.query.botAccount.findFirst();
  if (!account) return null;

  const now = Date.now();
  // This caller's lease value: releases are conditional on it, so a caller
  // whose lease expired can never clear a newer holder's lease.
  const lease = new Date(now + REFRESH_LEASE_MS);
  // Acquire the lease: only succeeds if unlocked or the previous lease expired.
  const [leased] = await db
    .update(schema.botAccount)
    .set({ refreshLockedUntil: lease })
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
    if (!opts.waitOnContention) {
      // Re-contended right after the previous holder gave up — don't wait again.
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Twitch token refresh is already in progress",
      });
    }
    // Another refresh is in flight — wait for it to publish a rotated token.
    const outcome = await waitForConcurrentRefresh(db, account);
    if (outcome !== HOLDER_FAILED) return outcome;
    // The holder released its lease without publishing anything: its refresh
    // failed. Retry once as the holder so the caller sees the real failure
    // (reauth vs transient) instead of the token Twitch just rejected.
    return refreshWithLease(db, creds, { waitOnContention: false });
  }

  // Everything below uses the row as of the lease, never the pre-lease read: a
  // refresh that committed in between has already consumed that token.

  try {
    let res: Response;
    try {
      res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: "refresh_token",
          refresh_token: leased.refreshToken,
        }),
        signal: withTimeout(),
      });
    } catch {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Twitch is unreachable" });
    }

    if (!res.ok) throw refreshFailure(res.status);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Twitch returned invalid JSON" });
    }
    const parsed = twitchRefreshResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Twitch returned an invalid token response",
      });
    }
    const data = parsed.data;

    // Conditional on the refresh token we spent: if the row changed under us
    // (our lease expired and another caller refreshed, or the account was
    // reconnected), never overwrite the newer tokens.
    const [updated] = await db
      .update(schema.botAccount)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? leased.refreshToken,
        expiresAt:
          data.expires_in != null
            ? new Date(Date.now() + data.expires_in * 1000)
            : leased.expiresAt,
        scopes: data.scope ?? leased.scopes,
        refreshLockedUntil: null, // release the lease
      })
      .where(
        and(
          eq(schema.botAccount.id, SINGLETON_ID),
          eq(schema.botAccount.refreshToken, leased.refreshToken),
        ),
      )
      .returning();
    if (updated) return updated;

    await releaseRefreshLease(db, lease);
    return (await db.query.botAccount.findFirst()) ?? null;
  } catch (err) {
    // Release the lease so a later attempt isn't blocked by our failure.
    await releaseRefreshLease(db, lease);
    throw err;
  }
}

/**
 * Map a failed Twitch refresh to a code the bot page can act on. UNAUTHORIZED
 * is reserved for a bad bot-page token, so a rejected refresh token never reads
 * as a reset link: 429/5xx is transient (retry), anything else means the bot
 * account has to be reconnected.
 */
function refreshFailure(status: number): TRPCError {
  if (status === 429 || status >= 500) {
    return new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Twitch token refresh is temporarily unavailable",
    });
  }
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: BOT_REAUTH_REQUIRED_MESSAGE,
  });
}

/**
 * Clear the refresh lease — only if it is still OURS. If our lease expired
 * mid-refresh and another caller took a new one, an unconditional clear would
 * let a third caller start a concurrent refresh with the same refresh token.
 * Best-effort: never throws over a failed refresh.
 */
async function releaseRefreshLease(db: DbClient, lease: Date): Promise<void> {
  try {
    await db
      .update(schema.botAccount)
      .set({ refreshLockedUntil: null })
      .where(
        and(
          eq(schema.botAccount.id, SINGLETON_ID),
          eq(schema.botAccount.refreshLockedUntil, lease),
        ),
      );
  } catch {
    // Lease expires on its own (REFRESH_LEASE_MS); swallowing is safe.
  }
}

/** Sentinel: the lease holder released its lease without publishing tokens. */
const HOLDER_FAILED = Symbol("holder-failed");

/**
 * Poll until the lease-holding refresh finishes. Twitch does not always rotate
 * the refresh token, so "published" means the lease is released and any token
 * field changed — that row is returned. A release with every token unchanged
 * means the holder's refresh FAILED; that is reported at once (HOLDER_FAILED)
 * rather than waiting out the budget and handing back the rejected token.
 * Falls back to the current row if the wait budget is exhausted (the holder
 * crashed and its lease will expire, letting the next caller retry itself).
 */
async function waitForConcurrentRefresh(
  db: DbClient,
  prior: Pick<BotAccountRow, "accessToken" | "refreshToken" | "expiresAt">,
): Promise<BotAccountRow | null | typeof HOLDER_FAILED> {
  for (let i = 0; i < REFRESH_WAIT_STEPS; i++) {
    await sleep(REFRESH_WAIT_STEP_MS);
    const row = await db.query.botAccount.findFirst();
    if (!row) return null;
    const changed =
      row.refreshToken !== prior.refreshToken ||
      row.accessToken !== prior.accessToken ||
      row.expiresAt.getTime() !== prior.expiresAt.getTime();
    if (row.refreshLockedUntil == null) {
      return changed ? row : HOLDER_FAILED; // published, or gave up unchanged
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

/** POST a token to Twitch's revoke endpoint; true only when Twitch confirms it. */
async function revokeAccessToken(creds: TwitchCredentials, token: string): Promise<boolean> {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: creds.clientId, token }),
      signal: withTimeout(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Refresh purely to obtain a revocable token; a failed refresh just means no token. */
async function refreshedAccessToken(
  db: DbClient,
  creds: TwitchCredentials,
): Promise<string | null> {
  try {
    return (await refreshBotToken(db, creds))?.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Disconnect the bot account: revoke the authorization at Twitch, then delete
 * the singleton row. Twitch rejects revoking an expired or dead access token
 * (leaving the grant in place), so such a token is refreshed first and the
 * fresh one revoked. Revocation failures never block deletion; `revoked` tells
 * the caller whether Twitch confirmed it.
 */
export async function disconnectBotAccount(
  db: DbClient,
  creds: TwitchCredentials,
): Promise<{ revoked: boolean }> {
  const account = await db.query.botAccount.findFirst({
    columns: { accessToken: true, expiresAt: true },
  });

  let revoked = false;
  if (account) {
    const nearExpiry = account.expiresAt.getTime() - Date.now() <= REFRESH_MARGIN_MS;
    const token = nearExpiry ? await refreshedAccessToken(db, creds) : account.accessToken;
    revoked = token ? await revokeAccessToken(creds, token) : false;
    if (!revoked && !nearExpiry) {
      // A fresh-looking token can still be dead server-side — revoke a new one.
      const retryToken = await refreshedAccessToken(db, creds);
      revoked = retryToken ? await revokeAccessToken(creds, retryToken) : false;
    }
  }

  await db.delete(schema.botAccount).where(eq(schema.botAccount.id, SINGLETON_ID));
  return { revoked };
}

/**
 * Resolve the IRC channel to JOIN: Twitch IRC requires the lowercase *login*
 * name, but better-auth only stores the display name (capitals, spaces or
 * localized names break JOIN). Logins can be renamed, so the stable twitchId is
 * looked up via Helix `GET /users?id=` with the bot's chat token on every
 * session bootstrap/revalidation, and the result is cached in
 * `instanceConfig.channelLogin`. The cache is the fallback when Helix fails;
 * after that, the lowercased display name (no twitchId — e.g. dev login).
 */
export async function resolveChannelLogin(
  db: DbClient,
  helix: { clientId: string; accessToken: string },
  owner: { twitchId: string | null; fallbackName: string },
): Promise<string> {
  const instance = await db.query.instanceConfig.findFirst({
    columns: { channelLogin: true },
  });
  const cachedLogin = twitchLoginSchema.safeParse(instance?.channelLogin);
  const cached = cachedLogin.success ? cachedLogin.data.toLowerCase() : null;

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
        const parsed = helixLoginResponseSchema.safeParse(await res.json());
        if (parsed.success) {
          const [user] = parsed.data.data;
          if (user) {
            const login = user.login.toLowerCase();
            if (login !== cached) {
              await updateSingleton(db, schema.instanceConfig, { channelLogin: login });
            }
            return login;
          }
        }
      }
    } catch {
      // Helix unreachable — fall through to the cached login.
    }
  }

  if (cached) return cached;

  const fallbackLogin = twitchLoginSchema.safeParse(owner.fallbackName.toLowerCase());
  if (fallbackLogin.success) return fallbackLogin.data;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Owner Twitch login unavailable",
  });
}
