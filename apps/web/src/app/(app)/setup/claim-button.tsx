"use client";

// The claim page's one Twitch button. The first sign-in claims the instance; a failed or
// refused sign-in comes back to `/setup?error=<code>`, which the page turns into a notice. The
// auth client loads on the click (lib/load-auth-client.ts), so the claim page never ships it.

import { loadAuthClient } from "@/lib/load-auth-client";
import { Button } from "@/components/ui/button";
import { TwitchIcon } from "@/components/icons/twitch-icon";

export function ClaimButton() {
  return (
    <Button
      size="lg"
      className="h-11 w-full gap-2 bg-twitch px-5 text-white hover:bg-twitch-hover sm:w-auto"
      onClick={async () => (await loadAuthClient())?.signInWithTwitch("/setup")}
    >
      <TwitchIcon className="size-4" />
      Claim with Twitch
    </Button>
  );
}
