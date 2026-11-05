"use client";

// Header account control: a Twitch sign-in button when signed out, otherwise the avatar
// dropdown (components/account-menu.tsx).

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import type { AccountLinks } from "@/lib/landing-links";
import { loadAuthClient } from "@/lib/load-auth-client";
import type { ServerSession } from "@/lib/server-session";
import { TwitchIcon } from "@/components/icons/twitch-icon";

import { Button } from "./ui/button";

// Loaded only when there is a session, so the signed-out pages (`/`, `/setup`) never fetch
// Base UI Menu and floating-ui. SSR stays on: the signed-in header renders the trigger in the
// server HTML and requests the chunk with the page, never on a later click (deploy skew).
const AccountMenu = dynamic(() => import("./account-menu"));

/**
 * Session-aware account control. `session` is the (app) layout's server session, so the
 * right control is in the server HTML — no loading state, and a signed-in owner never
 * sees the sign-in button flash.
 */
export default function UserMenu({
  session,
  links,
}: {
  session: ServerSession | null;
  links: AccountLinks;
}) {
  const pathname = usePathname();

  if (session === null) {
    // The viewer landing (`/`) carries its own, deliberately quiet owner sign-in, and the
    // claim page (`/setup`) its own "Claim with Twitch"; a second purple button in the header
    // would compete with the page's own action.
    if (pathname === "/" || pathname === "/setup") return null;
    return (
      <Button
        className="bg-twitch text-white hover:bg-twitch-hover"
        // A failed or refused sign-in returns to the home page, which renders the error
        // callout (the two pages that render their own button hide this one). The auth
        // client loads on the click (lib/load-auth-client.ts).
        onClick={async () => (await loadAuthClient())?.signInWithTwitch("/")}
      >
        <TwitchIcon className="size-3.5" />
        Sign in
      </Button>
    );
  }

  return <AccountMenu session={session} links={links} />;
}
