import prisma from "@dirework/db";
import { env } from "@dirework/env/server";
import { type NextRequest, NextResponse } from "next/server";

function errorRedirect(_request: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`/dashboard?bot=error&reason=${encodeURIComponent(reason)}`, env.BETTER_AUTH_URL),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return errorRedirect(request, "Missing code or state from Twitch");
  }

  let userId: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString(),
    );
    userId = decoded.userId;
  } catch {
    return errorRedirect(request, "Invalid state parameter");
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
      redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback`,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("Twitch token exchange failed:", tokenRes.status, body);
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
    await prisma.botAccount.upsert({
      where: { userId },
      update: {
        twitchId: botUser.id,
        username: botUser.login,
        displayName: botUser.display_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        userId,
        twitchId: botUser.id,
        username: botUser.login,
        displayName: botUser.display_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  } catch (err) {
    console.error("Failed to save bot account:", err);
    return errorRedirect(request, "Database error saving bot account");
  }

  return NextResponse.redirect(
    new URL("/dashboard?bot=connected", env.BETTER_AUTH_URL),
  );
}
