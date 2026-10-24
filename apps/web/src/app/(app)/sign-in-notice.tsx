"use client";

// Inline notice for a `?error=<code>` redirect (better-auth's errorCallbackURL or the bot
// OAuth bounces). The server page resolves the copy and renders this in the first paint;
// the only client work is stripping the query, so a refresh or a shared link doesn't
// re-show it. `history.replaceState` (which Next's router follows) instead of
// `router.replace`, which would refetch the page from the worker.

import { useEffect } from "react";

import type { SignInError } from "@/lib/sign-in-errors";
import { Callout } from "@/components/ui/callout";

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
          className="mt-1.5 block font-medium text-foreground underline underline-offset-4 hover:text-link focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {error.cta}
        </a>
      )}
    </Callout>
  );
}
