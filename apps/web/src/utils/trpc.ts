import type { AppRouter } from "@dirework/api/routers/index";

import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { env } from "@dirework/env/web";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      });
    },
  }),
});

/**
 * Authenticated tRPC client — same-origin.
 *
 * Calls /rpc/* on the web worker, which the Next rewrite proxies to the api
 * worker's /trpc/*. workers.dev is on the Public Suffix List, so the session
 * cookie can't be sent cross-worker — the request MUST stay same-origin.
 */
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/rpc",
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

/**
 * Public tRPC client — direct to the api worker, no cookies.
 *
 * For token-authenticated surfaces (overlay polling, /bot page) that would
 * otherwise pay a same-origin double hop on every poll. These procedures are
 * publicProcedure + token input, so no credentials are needed.
 */
export const publicTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000"}/trpc`,
    }),
  ],
});
