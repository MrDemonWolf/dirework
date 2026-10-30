// The dashboard stats' refresh trigger, React-free so it is tested against a real QueryClient.
// `stats.summary` is never polled: this refetches it when the polls the dashboard already runs
// see something stats depend on (lib/stats-view.ts `shouldRefreshStats`) and once just after
// each local midnight.

import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";

import {
  latestCompletion,
  scheduleDayRollover,
  shouldRefreshStats,
  timerPhaseKey,
  type StatsWatch,
} from "@/lib/stats-view";

export interface StatsRefreshKeys {
  timerKey: QueryKey;
  tasksKey: QueryKey;
  statsKey: QueryKey;
}

/**
 * Subscribe `queryClient` to the timer and task-list queries and invalidate `statsKey` once
 * per detected change. Only those two queries' `updated` events are considered (the stats
 * query's own invalidate/refetch events never re-enter the check), and the watermark is
 * stored BEFORE invalidating, since invalidation emits cache events synchronously. Returns
 * the unsubscribe function (it also cancels the midnight timer).
 */
export function subscribeStatsRefresh(
  queryClient: QueryClient,
  { timerKey, tasksKey, statsKey }: StatsRefreshKeys,
): () => void {
  const watched = new Set([hashKey(timerKey), hashKey(tasksKey)]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: statsKey });
  const read = (): StatsWatch => {
    const tasks = queryClient.getQueryData<{ tasks: Parameters<typeof latestCompletion>[0] }>(
      tasksKey,
    )?.tasks;
    return {
      timerPhase: timerPhaseKey(queryClient.getQueryData(timerKey)),
      latestDoneAt: tasks ? latestCompletion(tasks) : undefined,
    };
  };

  let seen = read();
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || !watched.has(event.query.queryHash)) return;
    const next = read();
    // Keep the last known value of either while the other updates.
    const merged: StatsWatch = {
      timerPhase: next.timerPhase ?? seen.timerPhase,
      latestDoneAt: next.latestDoneAt !== undefined ? next.latestDoneAt : seen.latestDoneAt,
    };
    const changed = shouldRefreshStats(seen, merged);
    seen = merged;
    if (changed) refresh();
  });
  const cancelRollover = scheduleDayRollover(refresh);
  return () => {
    unsubscribe();
    cancelRollover();
  };
}
