"use client";

// Dashboard stats: the four readouts under the greeting and the 14-day focus chart under
// the timer digits. Both read `stats.summary`, which rides the dashboard's one SSR batch and
// is never polled: `useStatsRefresh` refetches it only when the timer or task polls the page
// already runs see a change stats depend on. Copy and geometry live in lib/stats-view.ts.

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryError } from "@/components/query-error";
import {
  CHART,
  browserTimeZone,
  chartBars,
  formatDay,
  formatFocus,
  formatFocusLong,
  latestCompletion,
  scheduleDayRollover,
  shouldRefreshStats,
  statCellClass,
  statTiles,
  timerPhaseKey,
  type StatsWatch,
} from "@/lib/stats-view";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

/** The readout strip: one panel, four cells (2×2 on a phone, a row from lg). */
export function StatTiles() {
  const stats = useQuery(trpc.stats.summary.queryOptions());

  if (!stats.data) {
    if (stats.isFetching) return null;
    return (
      <QueryError
        title="Couldn't load your stats"
        onRetry={() => stats.refetch()}
        retrying={stats.isFetching}
        className="mb-6"
      />
    );
  }

  return (
    <section aria-label="Today's stats" className="panel mb-6 overflow-hidden">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {statTiles(stats.data).map((tile, i) => (
          <div key={tile.id} className={statCellClass(i)}>
            <dt className="console-label truncate">{tile.label}</dt>
            <dd className="font-heading text-2xl font-semibold tracking-tight">{tile.value}</dd>
            <dd className="truncate text-xs text-muted-foreground">{tile.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Focus minutes for the last 14 days as columns, today's in the accent. Each bar carries a
 * <title> (hover) and the sr-only table carries every value, so nothing depends on hover.
 */
export function FocusChart() {
  const stats = useQuery(trpc.stats.summary.queryOptions());
  if (!stats.data) return <div className="w-full max-w-sm" aria-hidden />;

  const bars = chartBars(stats.data.days);
  const total = stats.data.days.reduce((sum, d) => sum + d.focusMs, 0);
  const first = stats.data.days[0]?.day;

  return (
    <figure className="w-full max-w-sm" aria-labelledby="focus-chart-caption">
      <figcaption
        id="focus-chart-caption"
        className="mb-2 flex h-4 items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <span>Focus, last 14 days</span>
        <span>{formatFocus(total)} total</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        className="block h-auto w-full"
        aria-hidden
      >
        {bars.map((bar) => (
          <g key={bar.day} className="group">
            <title>{bar.title}</title>
            <rect
              x={bar.hit.x}
              y={0}
              width={bar.hit.width}
              height={CHART.height}
              fill="transparent"
            />
            <path
              d={bar.path}
              className={cn(
                "transition-opacity group-hover:opacity-80",
                bar.today ? "fill-primary" : "fill-muted-foreground/55",
              )}
            />
          </g>
        ))}
      </svg>
      <div
        className="mt-1.5 flex h-4 items-center justify-between font-mono text-2xs text-muted-foreground"
        aria-hidden
      >
        <span>{first ? formatDay(first) : ""}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Focus time per day, last 14 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Focus</th>
          </tr>
        </thead>
        <tbody>
          {stats.data.days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDay(d.day)}</th>
              <td>{formatFocusLong(d.focusMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Refetch `stats.summary` when the polls the dashboard already runs see a change stats
 * depend on (the timer moving to another phase, a newer task completion), and once just after each
 * local midnight (the summary's "today" and week are day-bound). A cache subscription, not
 * an observer, plus one timer a day: it adds no poll. The owner's own timer and task
 * mutations reach it the same way (they invalidate those queries).
 */
export function useStatsRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const timerKey = trpc.timer.get.queryKey();
    const tasksKey = trpc.task.list.queryKey();
    const statsKey = trpc.stats.summary.queryKey();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: statsKey });
    const read = (): StatsWatch => {
      const tasks = queryClient.getQueryData(tasksKey)?.tasks;
      return {
        timerPhase: timerPhaseKey(queryClient.getQueryData(timerKey)),
        latestDoneAt: tasks ? latestCompletion(tasks) : undefined,
      };
    };
    let seen = read();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const next = read();
      // Keep the last known value of either while the other updates.
      const merged: StatsWatch = {
        timerPhase: next.timerPhase ?? seen.timerPhase,
        latestDoneAt: next.latestDoneAt !== undefined ? next.latestDoneAt : seen.latestDoneAt,
      };
      if (shouldRefreshStats(seen, merged)) refresh();
      seen = merged;
    });
    const cancelRollover = scheduleDayRollover(refresh);
    return () => {
      unsubscribe();
      cancelRollover();
    };
  }, [queryClient]);
}

/**
 * Report the browser's zone once when the stored one differs (stats bucket by the owner's
 * local day). One guarded write per change of zone, then `me` is patched in place.
 */
export function useTimeZoneSync(storedTimeZone: string | null | undefined) {
  const queryClient = useQueryClient();
  const sent = useRef(false);
  const setTimeZone = useMutation({
    ...trpc.user.setTimeZone.mutationOptions(),
    onSuccess: ({ timeZone, changed }) => {
      queryClient.setQueryData(trpc.user.me.queryKey(), (me) => (me ? { ...me, timeZone } : me));
      if (changed) void queryClient.invalidateQueries({ queryKey: trpc.stats.summary.queryKey() });
    },
  });
  const { mutate } = setTimeZone;

  useEffect(() => {
    // undefined = `me` not loaded yet.
    if (storedTimeZone === undefined || sent.current) return;
    const zone = browserTimeZone();
    if (!zone || zone === storedTimeZone) return;
    sent.current = true;
    mutate({ timeZone: zone });
  }, [storedTimeZone, mutate]);
}
