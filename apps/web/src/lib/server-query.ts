// Per-page server prefetches. Each returns a dehydrated cache for a <HydrationBoundary>, so
// the client components mount with their data instead of fetching it.
//
// Two shapes:
//  - `prefetchStyles` (Theme Center) awaits the whole batch and dehydrates only successes. A
//    failed prefetch degrades to the client fetch (skeleton first).
//  - `streamQueries` (the dashboard, Bot settings; any page built from progressive sections)
//    waits for the batch only up to `SECTIONS_READY_MS` (lib/progressive.ts). What arrived by
//    then is dehydrated as data; what is still in flight is dehydrated as a promise, which
//    streams to the browser through the RSC payload, so that section fills in on its own when
//    its result lands. Still ONE request.

import {
  defaultShouldDehydrateQuery,
  dehydrate,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";

import { sectionsReady } from "@/lib/progressive";
import { createServerTrpc } from "@/lib/server-trpc";
import { getQueryClient } from "@/utils/trpc";

type ServerTrpc = ReturnType<typeof createServerTrpc>;

/**
 * Start `start`'s prefetches as ONE streamed batch (issued in the same tick, so
 * `httpBatchStreamLink` folds them into a single GET whose results arrive one by one), wait
 * until they have all settled or `SECTIONS_READY_MS` has passed, then dehydrate: successes
 * as data, queries still in flight as pending promises. `start` calls
 * `queryClient.prefetchQuery(t.….queryOptions())` per query and returns the promises.
 *
 * Never throws. A query that already failed is left out (the client refetches it on mount,
 * exactly like a failed awaited prefetch); one that fails after the deadline rejects only its
 * own streamed promise, and the client then refetches it too.
 */
export async function streamQueries(
  start: (t: ServerTrpc, queryClient: QueryClient) => readonly Promise<void>[],
): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  await sectionsReady(start(createServerTrpc(queryClient), queryClient));
  return dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  });
}

/**
 * Dashboard home: session-scoped user (overlay tokens, bot, setup), timer, config, tasks and
 * the stats summary — still ONE batch, so the stats cost no extra request.
 */
export function streamDashboard(): Promise<DehydratedState> {
  return streamQueries((t, queryClient) => [
    queryClient.prefetchQuery(t.user.me.queryOptions()),
    queryClient.prefetchQuery(t.timer.get.queryOptions()),
    queryClient.prefetchQuery(t.config.get.queryOptions()),
    queryClient.prefetchQuery(t.task.list.queryOptions()),
    queryClient.prefetchQuery(t.stats.summary.queryOptions()),
  ]);
}

/** Theme Center: the full config. */
export async function prefetchStyles(): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  const t = createServerTrpc(queryClient);
  await queryClient.prefetchQuery(t.config.get.queryOptions());
  return dehydrate(queryClient);
}

/**
 * Bot settings: the config (commands, replies, live switches) and the user (bot account), as
 * ONE streamed batch for the (sections) layout, so each card fills in on its own.
 */
export function streamBot(): Promise<DehydratedState> {
  return streamQueries((t, queryClient) => [
    queryClient.prefetchQuery(t.config.get.queryOptions()),
    queryClient.prefetchQuery(t.user.me.queryOptions()),
  ]);
}
