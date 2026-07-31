import { TWITCH_FETCH_TIMEOUT_MS } from "@dirework/api/services/twitch-auth";
import { recordError, recordMetric } from "../lib/telemetry";
import {
  parseOAuthCallbackParams,
  isTimeoutError,
  parseBotOAuthState,
  parseTwitchHelixUser,
  parseTwitchTokenResponse,
} from "../lib/twitch-oauth-response";
import { createAuth } from "@dirework/auth";
import { createDb, schema } from "@dirework/db";
import { env } from "@dirework/env/server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

/**
 * Bot-account OAuth flow (second Twitch OAuth, separate from better-auth
 * login). Mounted at /api/bot — the browser reaches it through the web
 * worker's same-origin proxy route handler (apps/web app/api/bot/[...path],
 * redirect: "manual"), so cookies and redirects behave same-origin.
 *
 * Tokens for the bot account are only ever stored in D1 — never logged,
 * never placed in redirect URLs.
 */

const secureCookie = env.BETTER_AUTH_URL.startsWith("https");
const STATE_COOKIE = secureCookie ? "__Host-dirework_bot_oauth_nonce" : "bot_oauth_nonce";
const STATE_COOKIE_PATH = "/";
/**
 * chat:read / chat:edit — required by the IRC connection the browser bot page
 * actually uses (wss://irc-ws.chat.twitch.tv; replies go out as PRIVMSG).
 * user:read:chat / user:write:chat — Helix/EventSub chat scopes, currently
 * unused but kept so a future move to Helix sends won't force yet another
 * reconnect. Bot accounts connected before chat:read/chat:edit were added
 * must be reconnected to pick up the new scopes.
 */
const BOT_SCOPES = ["chat:read", "chat:edit", "user:read:chat", "user:write:chat"] as const;

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeState(payload: { userId: string; nonce: string }): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time-ish string comparison (no early exit on content mismatch). */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

function errorRedirect(reason: string): string {
  return `${env.BETTER_AUTH_URL}/dashboard/bot?bot=error&reason=${encodeURIComponent(reason)}`;
}

async function safeTwitchFetch(
  url: string,
  init: RequestInit,
  label: "token_exchange" | "user_lookup",
): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch (error) {
    recordMetric(isTimeoutError(error) ? "upstream.timeout" : "oauth.failure", { label });
    recordError({ error, reason: label });
    return null;
  }
}

export const botOAuth = new Hono();

botOAuth.get("/authorize", async (c) => {
  const auth = createAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.redirect(`${env.BETTER_AUTH_URL}/?error=not_authenticated`);
  }
  if (!session.user.isOwner) {
    return c.redirect(`${env.BETTER_AUTH_URL}/?error=not_owner`);
  }

  const nonce = randomNonce();
  const state = encodeState({ userId: session.user.id, nonce });

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback/twitch`,
    response_type: "code",
    scope: BOT_SCOPES.join(" "),
    force_verify: "true",
    state,
  });

  setCookie(c, STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "Lax",
    path: STATE_COOKIE_PATH,
    maxAge: 600,
  });

  return c.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
});

botOAuth.get("/callback/twitch", async (c) => {
  const callback = parseOAuthCallbackParams(c.req.query("code"), c.req.query("state"));

  if (!callback) {
    return c.redirect(errorRedirect("Missing code or state from Twitch"));
  }

  const { code, state } = callback;
  const decoded = parseBotOAuthState(state);
  if (!decoded) {
    return c.redirect(errorRedirect("Invalid state parameter"));
  }

  // Verify CSRF nonce from httpOnly cookie
  const storedNonce = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: STATE_COOKIE_PATH, secure: secureCookie });
  if (!storedNonce || !decoded.nonce || !safeEqual(storedNonce, decoded.nonce)) {
    return c.redirect(errorRedirect("Invalid or expired OAuth state — please try again"));
  }

  // Verify the current session matches the userId from state
  const auth = createAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.id !== decoded.userId || !session.user.isOwner) {
    return c.redirect(
      errorRedirect("Session expired or mismatch — please try connecting your bot again"),
    );
  }

  // Exchange code for tokens. Network/timeout errors are converted to a safe
  // dashboard redirect; neither the callback URL nor caught message is logged.
  const tokenRes = await safeTwitchFetch(
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback/twitch`,
      }),
      signal: AbortSignal.timeout(TWITCH_FETCH_TIMEOUT_MS),
    },
    "token_exchange",
  );

  if (!tokenRes) {
    return c.redirect(errorRedirect("Twitch token service unavailable — please try again"));
  }
  if (!tokenRes.ok) {
    // Status only — the response body can echo the submitted code or secret.
    recordMetric("oauth.failure", { label: `token_exchange_${tokenRes.status}` });
    return c.redirect(
      errorRedirect("Token exchange failed — check redirect URI matches Twitch app"),
    );
  }

  let tokenBody: unknown;
  try {
    tokenBody = await tokenRes.json();
  } catch {
    tokenBody = null;
  }
  const tokens = parseTwitchTokenResponse(tokenBody);
  if (!tokens) {
    recordMetric("oauth.failure", { label: "invalid_token_response" });
    return c.redirect(errorRedirect("Twitch returned an invalid token response"));
  }

  const userRes = await safeTwitchFetch(
    "https://api.twitch.tv/helix/users",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Client-Id": env.TWITCH_CLIENT_ID,
      },
      signal: AbortSignal.timeout(TWITCH_FETCH_TIMEOUT_MS),
    },
    "user_lookup",
  );

  if (!userRes) {
    return c.redirect(errorRedirect("Twitch user service unavailable — please try again"));
  }
  if (!userRes.ok) {
    recordMetric("oauth.failure", { label: `user_lookup_${userRes.status}` });
    return c.redirect(errorRedirect("Failed to fetch bot user info from Twitch"));
  }

  let userBody: unknown;
  try {
    userBody = await userRes.json();
  } catch {
    userBody = null;
  }
  const botUser = parseTwitchHelixUser(userBody);
  if (!botUser) {
    recordMetric("oauth.failure", { label: "invalid_user_response" });
    return c.redirect(errorRedirect("No valid user data returned from Twitch"));
  }

  // Upsert the singleton bot account row — tokens only ever live in D1.
  const botAccountValues = {
    twitchId: botUser.id,
    username: botUser.login,
    displayName: botUser.display_name,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: Array.isArray(tokens.scope) ? tokens.scope : [...BOT_SCOPES],
  };

  try {
    const db = createDb();
    await db
      .insert(schema.botAccount)
      .values({ id: schema.SINGLETON_ID, ...botAccountValues })
      .onConflictDoUpdate({
        target: schema.botAccount.id,
        set: botAccountValues,
      });
  } catch (error) {
    // Redacted: a raw D1 error echoes the failing statement, which here carries
    // the bot's access and refresh tokens.
    recordMetric("db.error", { label: "bot_account_upsert" });
    recordError({ error, url: c.req.url, reason: "bot_account_upsert" });
    return c.redirect(errorRedirect("Database error saving bot account"));
  }

  return c.redirect(`${env.BETTER_AUTH_URL}/dashboard/bot?bot=connected`);
});
