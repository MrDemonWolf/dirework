import { randomBytes } from "node:crypto";
import { auth } from "@dirework/auth";
import { env } from "@dirework/env/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/?error=not_authenticated", env.BETTER_AUTH_URL));
  }

  const nonce = randomBytes(32).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, nonce }),
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback/twitch`,
    response_type: "code",
    scope: "user:read:chat user:write:chat",
    force_verify: "true",
    state,
  });

  const response = NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
  response.cookies.set("bot_oauth_nonce", nonce, {
    httpOnly: true,
    secure: env.BETTER_AUTH_URL.startsWith("https"),
    sameSite: "lax",
    path: "/api/bot/callback",
    maxAge: 300,
  });
  return response;
}
