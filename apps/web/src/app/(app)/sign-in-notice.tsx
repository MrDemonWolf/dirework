"use client";

// Inline notice for a `?error=<code>` redirect (better-auth's errorCallbackURL or the bot
// OAuth bounces). The server page resolves the copy and renders this in the first paint;
// the only client work is stripping the query, so a refresh or a shared link doesn't
// re-show it. `history.replaceState` (which Next's router follows) instead of
// `router.replace`, which would refetch the page from the worker.

import { useEffect } from "react";

import type { SignInError } from "@/lib/sign-in-errors";
import { linkVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/utils";

export function SignInNotice({ error, deployUrl }: { error: SignInError; deployUrl: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, []);

  return (
    <Callout className="w-full max-w-xl" title={error.title}>
      {error.hint}
      {error.cta && (
        <a
          href={deployUrl}
          className={cn("mt-1.5 block w-fit", linkVariants({ variant: "proseOnTint" }))}
        >
          {error.cta}
        </a>
      )}
    </Callout>
  );
}
