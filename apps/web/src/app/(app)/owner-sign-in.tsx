"use client";

// The landing page's one Twitch button, for the streamer who owns this DireWork. Everyone
// else who presses it is refused (`instance_claimed`) and comes back to `/?error=…`. The auth
// client loads on the click (lib/load-auth-client.ts), so the landing never ships it.

import { loadAuthClient } from "@/lib/load-auth-client";
import { Button } from "@/components/ui/button";
import { TwitchIcon } from "@/components/icons/twitch-icon";

export function OwnerSignIn() {
  return (
    <Button
      className="gap-2 bg-twitch text-white hover:bg-twitch-hover"
      // A refused or failed sign-in comes back here as `/?error=<code>`.
      onClick={async () => (await loadAuthClient())?.signInWithTwitch("/")}
    >
      <TwitchIcon className="size-4" />
      Sign in with Twitch
    </Button>
  );
}
