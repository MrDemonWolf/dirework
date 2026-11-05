import type { AppRouter } from "@dirework/api/routers/index";

import { createTRPCClient, httpBatchLink } from "@trpc/client";

import { TRPC_MAX_BATCH_SIZE } from "@dirework/api/config-defaults";
import { apiOrigin } from "@/lib/api-origin";
import { deployReloader } from "@/lib/deploy-reload";
import { withRequestTimeout } from "@/lib/fetch-timeout";

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
 *
 * Every answer's build id (`x-dirework-build`) goes to the page's deploy reloader
 * (lib/deploy-reload.ts), which the overlays and the bot page consult to reload
 * once after a deploy: no request of its own.
 */
export const publicTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiOrigin()}/trpc`,
      maxItems: TRPC_MAX_BATCH_SIZE,
      async fetch(url, options) {
        const response = await fetch(url, {
          ...options,
          signal: withRequestTimeout(options?.signal),
        });
        deployReloader()?.noteResponse(response);
        return response;
      },
    }),
  ],
});
