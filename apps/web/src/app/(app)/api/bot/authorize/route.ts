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

  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id }),
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    redirect_uri: `${env.BETTER_AUTH_URL}/api/bot/callback`,
    response_type: "code",
    scope: "chat:read chat:edit",
    force_verify: "true",
    state,
  });

  return NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
}
