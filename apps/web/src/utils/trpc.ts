import type { AppRouter } from "@dirework/api/routers/index";

import { isServer, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { TRPC_MAX_BATCH_SIZE } from "@dirework/api/config-shared";
import { apiOrigin } from "@/lib/api-origin";
import { withRequestTimeout } from "@/lib/fetch-timeout";
import { QUERY_FRESH_MS } from "@/lib/poll-intervals";
import { toastQueryError } from "@/lib/query-error-toast";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // Toasts with a retry action; queries marked meta.silent (OBS overlay
      // polling) never toast, so nothing is composited onto the stream. Not on
      // the server: a failed SSR prefetch just falls back to the client fetch,
      // and sonner's toast store is module state that no render would drain.
      onError: isServer ? undefined : toastQueryError,
    }),
    defaultOptions: {
      // A client default, not per-query: several observers share one key
      // (user.me and task.list each have several) and React
      // Query applies each observer's own staleTime, so a per-query value would
      // have to be repeated everywhere. It only stops hydrated SSR data from
      // being refetched on mount; polls and invalidations ignore it, so the
      // request budget is unchanged.
      queries: { staleTime: QUERY_FRESH_MS },
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

/**
 * Authenticated tRPC client — same-origin.
 *
 * Calls /rpc/* on the web worker, whose route handler proxies to the api
 * worker's /trpc/*. Auth cookies are host-only on the web origin, so the
 * session never reaches the api worker directly — the request MUST stay
 * same-origin. (Sibling workers under <account>.workers.dev are same-site; the
 * api's /trpc JSON-only guard, not SameSite, is the CSRF boundary.)
 */
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/rpc",
      maxItems: TRPC_MAX_BATCH_SIZE,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
          signal: withRequestTimeout(options?.signal),
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient: getQueryClient,
});

/**
 * Public tRPC client — direct to the api worker, no cookies.
 *
 * For token-authenticated surfaces (overlay polling, /bot page) that would
 * otherwise pay a same-origin double hop on every poll. These procedures are
 * publicProcedure + token input, so no credentials are needed.
 *
 * Every request is time-boxed: the bot page relays chat through a serial
 * queue, so one hung ingest would otherwise stall every later command. A
 * timeout rejects the call, the queue moves on, and the command is dropped.
 */
export const publicTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiOrigin()}/trpc`,
      maxItems: TRPC_MAX_BATCH_SIZE,
      fetch(url, options) {
        return fetch(url, { ...options, signal: withRequestTimeout(options?.signal) });
      },
    }),
  ],
});
