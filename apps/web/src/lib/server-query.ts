// Per-page server prefetches. Each returns a dehydrated cache for a <HydrationBoundary>, so
// the client components mount with their data instead of fetching it.
//
// `prefetchQuery` never throws and `dehydrate` keeps only successful queries, so a failed
// prefetch degrades to today's behaviour: the client fetches on mount (skeleton first).

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { createServerTrpc } from "@/lib/server-trpc";
import { getQueryClient } from "@/utils/trpc";

/** Dashboard home: session-scoped user (overlay tokens, bot), timer, config and tasks. */
export async function prefetchDashboard(): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  const t = createServerTrpc(queryClient);
  await Promise.all([
    queryClient.prefetchQuery(t.user.me.queryOptions()),
    queryClient.prefetchQuery(t.timer.get.queryOptions()),
    queryClient.prefetchQuery(t.config.get.queryOptions()),
    queryClient.prefetchQuery(t.task.list.queryOptions()),
  ]);
  return dehydrate(queryClient);
}

/** Theme Center: the full config. */
export async function prefetchStyles(): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  const t = createServerTrpc(queryClient);
  await queryClient.prefetchQuery(t.config.get.queryOptions());
  return dehydrate(queryClient);
}

/** Bot settings: the config (commands, messages) and the user (bot account). */
export async function prefetchBot(): Promise<DehydratedState> {
  const queryClient = getQueryClient();
  const t = createServerTrpc(queryClient);
  await Promise.all([
    queryClient.prefetchQuery(t.config.get.queryOptions()),
    queryClient.prefetchQuery(t.user.me.queryOptions()),
  ]);
  return dehydrate(queryClient);
}
