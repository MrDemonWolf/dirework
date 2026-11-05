import type { AppRouter } from "@dirework/api/routers/index";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { TRPC_MAX_BATCH_SIZE } from "@dirework/api/config-defaults";
import { authLapseLink, fetchRpc } from "@/lib/auth-lapse";
import { getQueryClient } from "@/utils/query-client";

// The authenticated (app) client only. The shared QueryClient lives in ./query-client and
// the token pages' direct client in ./public-trpc, so the OBS overlays and the bot page never
// load this options proxy.

/**
 * Authenticated tRPC client — same-origin.
 *
 * Calls /rpc/* on the web worker, whose route handler proxies to the api
 * worker's /trpc/*. Auth cookies are host-only on the web origin, so the
 * session never reaches the api worker directly — the request MUST stay
 * same-origin. (Sibling workers under <account>.workers.dev are same-site; the
 * api's /trpc JSON-only guard, not SameSite, is the CSRF boundary.)
 *
 * When the owner's sign-in lapses (a refused session, or an edge sign-in wall's
 * redirect, which `fetchRpc` never follows), `authLapseLink` stops the dashboard
 * polls and answers later reads without sending them: lib/auth-lapse.ts.
 */
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    authLapseLink(),
    httpBatchLink({ url: "/rpc", maxItems: TRPC_MAX_BATCH_SIZE, fetch: fetchRpc }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient: getQueryClient,
});
