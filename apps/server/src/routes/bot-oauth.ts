import { createAuth } from "@dirework/auth";
import { createDb, schema } from "@dirework/db";
import { env } from "@dirework/env/server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

/**
 * Bot-account OAuth flow (second Twitch OAuth, separate from better-auth
 * login). Mounted at /api/bot — the browser reaches it through the web
 * worker's same-origin Next rewrite proxy, so cookies behave same-origin.
 *
 * Tokens for the bot account are only ever stored in D1 — never logged,
 * never placed in redirect URLs.
 */

const STATE_COOKIE = "bot_oauth_nonce";
const BOT_SCOPES = ["user:read:chat", "user:write:chat"] as const;

interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
}

interface TwitchHelixUser {
  id: string;
  login: string;
  display_name: string;
}

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

function decodeState(state: string): { userId: string; nonce: string } | null {
  try {
    const base64 =
      state.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (state.length % 4)) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as Record<string, unknown>).userId === "string" &&
      typeof (decoded as Record<string, unknown>).nonce === "string"
    ) {
      return decoded as { userId: string; nonce: string };
    }
    return null;
  } catch {
    return null;
  }
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
    secure: env.BETTER_AUTH_URL.startsWith("https"),
    sameSite: "Lax",
    path: "/api/bot",
    maxAge: 600,
  });

  return c.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
});

botOAuth.get("/callback/twitch", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.redirect(errorRedirect("Missing code or state from Twitch"));
  }

  const decoded = decodeState(state);
  if (!decoded) {
    return c.redirect(errorRedirect("Invalid state parameter"));
  }

  // Verify CSRF nonce from httpOnly cookie
  const storedNonce = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/api/bot" });
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

  // Exchange code for tokens
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback/twitch`,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[BotOAuth] Twitch token exchange failed:", tokenRes.status);
    return c.redirect(
      errorRedirect("Token exchange failed — check redirect URI matches Twitch app"),
    );
  }

  const tokens = (await tokenRes.json()) as TwitchTokenResponse;

  // Get bot user info from Twitch
  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });

  if (!userRes.ok) {
    return c.redirect(errorRedirect("Failed to fetch bot user info from Twitch"));
  }

  const {
    data: [botUser],
  } = (await userRes.json()) as { data: TwitchHelixUser[] };

  if (!botUser) {
    return c.redirect(errorRedirect("No user data returned from Twitch"));
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
  } catch (err) {
    console.error("[BotOAuth] Failed to save bot account:", err);
    return c.redirect(errorRedirect("Database error saving bot account"));
  }

  return c.redirect(`${env.BETTER_AUTH_URL}/dashboard/bot?bot=connected`);
});
