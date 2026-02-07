import prisma from "@dirework/db";
import { env } from "@dirework/env/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?bot=error", request.url),
    );
  }

  let userId: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString(),
    );
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard?bot=error", request.url),
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
      redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/dashboard?bot=error", request.url),
    );
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
    return NextResponse.redirect(
      new URL("/dashboard?bot=error", request.url),
    );
  }

  const {
    data: [botUser],
  } = await userRes.json();

  // Upsert bot account
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

  return NextResponse.redirect(
    new URL("/dashboard?bot=connected", request.url),
  );
}
