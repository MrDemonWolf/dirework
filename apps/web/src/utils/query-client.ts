import { isServer, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { shouldRetryQuery } from "@/lib/auth-lapse";
import { QUERY_FRESH_MS } from "@/lib/poll-intervals";
import { reportMutationError, reportQueryError } from "@/lib/query-error-reporter";

// The React Query client, mounted by the (app) providers and the (overlay) provider. No tRPC
// here, so an overlay loads React Query without the dashboard's /rpc options proxy (./trpc);
// the bot page loads neither (it calls the plain client in ./public-trpc).

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // The registered reporter: on the (app) routes, AppToaster's toast with a
      // retry action; on the OBS overlays and the bot page, none, so they never
      // load sonner. Queries marked meta.silent (overlay polling) never report,
      // so nothing is composited onto the stream. Not on the server: a failed SSR
      // prefetch just falls back to the client fetch, and sonner's toast store is
      // module state that no render would drain.
      onError: isServer ? undefined : reportQueryError,
    }),
    // A write refused because the sign-in lapsed raises the same reload toast, through the
    // same registry, so a token page (no AppToaster) loads no sonner for it either.
    mutationCache: new MutationCache({ onError: isServer ? undefined : reportMutationError }),
    defaultOptions: {
      queries: {
        // A client default, not per-query: several observers share one key
        // (user.me and task.list each have several) and React
        // Query applies each observer's own staleTime, so a per-query value would
        // have to be repeated everywhere. It only stops hydrated SSR data from
        // being refetched on mount; polls and invalidations ignore it, so the
        // request budget is unchanged.
        staleTime: QUERY_FRESH_MS,
        // The browser never retries a 4xx (a refused poll used to go out four times
        // a cycle) and retries a network failure or 5xx twice (lib/auth-lapse.ts).
        // The server never retries: a failed prefetch falls back to the client
        // fetch, and prefetchQuery takes this default over its own `retry: false`.
        retry: isServer ? false : shouldRetryQuery,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per server render (an isolate serves many requests, so a
 * module-level cache would pile up entries — token-bearing query keys
 * included — across them), and one long-lived client in the browser.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
