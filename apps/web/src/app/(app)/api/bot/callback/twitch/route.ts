import { timingSafeEqual } from "node:crypto";
import { auth } from "@dirework/auth";
import { db } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { logger } from "@dirework/api/logger";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

function errorRedirect(_request: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/bot?bot=error&reason=${encodeURIComponent(reason)}`, env.BETTER_AUTH_URL),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return errorRedirect(request, "Missing code or state from Twitch");
  }

  let userId: string;
  let nonce: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString(),
    );
    userId = decoded.userId;
    nonce = decoded.nonce;
  } catch {
    return errorRedirect(request, "Invalid state parameter");
  }

  // Verify CSRF nonce from httpOnly cookie
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("bot_oauth_nonce")?.value;
  if (!storedNonce || !nonce || !timingSafeEqual(Buffer.from(storedNonce), Buffer.from(nonce))) {
    return errorRedirect(request, "Invalid or expired OAuth state — please try again");
  }

  // Verify the current session matches the userId from state
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.id !== userId) {
    return errorRedirect(request, "Session expired or mismatch — please try connecting your bot again");
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
    const body = await tokenRes.text().catch(() => "");
    logger.error("[Auth] Twitch token exchange failed:", tokenRes.status, body);
    return errorRedirect(request, "Token exchange failed — check redirect URI matches Twitch app");
  }

  const tokens = await tokenRes.json();

  // Get bot user info from Twitch
  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });

  if (!userRes.ok) {
    return errorRedirect(request, "Failed to fetch bot user info from Twitch");
  }

  const {
    data: [botUser],
  } = await userRes.json();

  if (!botUser) {
    return errorRedirect(request, "No user data returned from Twitch");
  }

  // Upsert bot account
  try {
    await db.insert(schema.botAccount)
      .values({
        userId,
        twitchId: botUser.id,
        username: botUser.login,
        displayName: botUser.display_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .onConflictDoUpdate({
        target: schema.botAccount.userId,
        set: {
          twitchId: botUser.id,
          username: botUser.login,
          displayName: botUser.display_name,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
  } catch (err) {
    logger.error("[Auth] Failed to save bot account:", err);
    return errorRedirect(request, "Database error saving bot account");
  }

  return NextResponse.redirect(
    new URL("/dashboard/bot?bot=connected", env.BETTER_AUTH_URL),
  );
}
