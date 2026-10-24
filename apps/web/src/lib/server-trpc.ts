// Server-render tRPC client: lets a page prefetch owner queries straight from the api
// worker, so the HTML streams with its data instead of a skeleton.

import type { AppRouter } from "@dirework/api/routers/index";
import type { QueryClient } from "@tanstack/react-query";

import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";

import { TRPC_MAX_BATCH_SIZE } from "@dirework/api/config-shared";
import { apiOrigin } from "@/lib/api-origin";
import { stampForwardedClient } from "@/lib/auth-proxy";
import { withRequestTimeout } from "@/lib/fetch-timeout";
import { INTERNAL_FETCH_TIMEOUT_MS } from "@/lib/server-session";

/**
 * A tRPC options proxy bound to `queryClient`, for server components only. Built per call
 * (no module state: an isolate serves many requests, each with its own cookie).
 *
 * Calls go DIRECT to the api worker's `/trpc` (never the web worker's `/rpc` proxy, which
 * would add a Worker hop per render) with the browser's cookie and the signed client IP,
 * exactly like `getServerSession`. Query keys are built from path + input only, so they
 * match the browser `trpc` proxy's and the dehydrated cache hydrates in place.
 *
 * `httpBatchStreamLink` folds every query issued in the same tick into ONE GET request
 * (queries are GETs, so the api's JSON-only POST guard does not apply) and reads the answer as
 * a stream (`trpc-accept: application/jsonl`): each procedure's result resolves the moment the
 * api writes it, not when the slowest one finishes. That is what lets a page fill its sections
 * in independently (lib/progressive.ts) without a second request.
 */
export function createServerTrpc(queryClient: QueryClient) {
  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchStreamLink({
        url: `${apiOrigin()}/trpc`,
        maxItems: TRPC_MAX_BATCH_SIZE,
        async headers() {
          const incoming = await headers();
          // Only the cookie is forwarded; stampForwardedClient strips any client-supplied
          // forwarded-IP headers and signs the browser's own CF-Connecting-IP.
          const outgoing = await stampForwardedClient(
            new Headers({ cookie: incoming.get("cookie") ?? "" }),
            incoming,
          );
          return Object.fromEntries(outgoing.entries());
        },
        fetch(url, init) {
          return fetch(url, {
            ...init,
            cache: "no-store",
            signal: withRequestTimeout(init?.signal, INTERNAL_FETCH_TIMEOUT_MS),
          });
        },
      }),
    ],
  });

  return createTRPCOptionsProxy<AppRouter>({ client, queryClient });
}
