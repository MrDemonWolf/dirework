// Loading placeholders for the dashboard, one per progressive section, plus the whole-page
// `DashboardSkeleton` built from them. Each repeats its live section's own layout classes and
// box sizes (measured at 1280px and 412px wide), so a section filling in does not move the
// page; update them alongside dashboard.tsx, timer-controls.tsx and task-manager.tsx.
//
// Where they show:
//  - A section's placeholder, inside the live frame, only when that section's data missed the
//    first-paint deadline (lib/progressive.ts).
//  - `DashboardSkeleton` on client navigation (dashboard/loading.tsx), while the next page's
//    server render round-trips: there is no session yet, so even the greeting is a block.
//
// The task list's height follows the number of tasks, so its placeholder is a typical board.

import { Skeleton } from "@/components/ui/skeleton";
import { statCellClass } from "@/lib/stats-view";

/** A status chip (`StatusChip`: 27px tall). */
function ChipSkeleton({ className }: { className: string }) {
  return <Skeleton className={`h-6.75 rounded-full ${className}`} />;
}

/**
 * An overlay monitor with its preview off: rule + size chip, URL row, then the hint and the
 * Live preview toggle, which wrap onto two rows in a narrow column exactly like the live ones.
 */
function MonitorSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex h-5.5 items-center justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5.5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Skeleton className="h-4 w-58" />
        <Skeleton className="ml-auto h-6 w-28" />
      </div>
    </div>
  );
}

/**
 * The header band's status cluster: the timer status chip and the bot chip, whose link takes
 * a 44px hit area on touch screens.
 */
export function StatusClusterPlaceholder() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSkeleton className="w-18" />
      <div className="inline-flex items-center pointer-coarse:min-h-11">
        <ChipSkeleton className="w-36" />
      </div>
    </div>
  );
}

/**
 * The stats strip under the greeting (`StatTiles`): one panel of four cells, 2×2 on a phone
 * and a row from lg, each a label, a value and a detail line.
 */
export function StatTilesPlaceholder() {
  return (
    <div className="panel mb-6 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {["focus", "pomodoros", "tasks", "week"].map((id, i) => (
          <div key={id} className={statCellClass(i)}>
            <Skeleton className="h-4.5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The 14-day focus chart (`FocusChart`): caption row, the 5:1 plot, the date row. */
export function FocusChartPlaceholder() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-2 flex h-4 items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="aspect-5/1 w-full" />
      <div className="mt-1.5 flex h-4 items-center justify-between">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-8" />
      </div>
    </div>
  );
}

/** The timer console below its heading: instrument (3/5) | transport, settings, monitor (2/5). */
export function TimerConsoleBodyPlaceholder() {
  return (
    <div className="grid lg:grid-cols-5">
      <div className="flex flex-col items-center justify-center gap-8 px-5 py-8 lg:col-span-3">
        <div className="flex w-full flex-col items-center gap-5">
          <ChipSkeleton className="w-21.5" />
          <Skeleton className="h-18 w-52.5 lg:h-24 lg:w-70" />
          <Skeleton className="h-1.5 w-full max-w-xs rounded-full" />
          <Skeleton className="h-2 w-14" />
        </div>
        <FocusChartPlaceholder />
      </div>
      <div className="flex min-w-0 flex-col gap-5 border-t border-border/40 px-5 py-5 lg:col-span-2 lg:border-t-0 lg:border-l">
        {/* Transport bar, then the folded session settings (its summary wraps on a phone). */}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-19 w-full rounded-xl lg:h-15" />
        <MonitorSkeleton />
      </div>
    </div>
  );
}

/** The task board: header band; form + groups (2/3) | tasks monitor (1/3). */
export function TaskBoardPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/40 px-5 pt-4 pb-3">
        <Skeleton className="h-4.5 w-22" />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="w-56.25 space-y-1">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex items-end gap-5">
            <Skeleton className="h-12.5 w-10" />
            <Skeleton className="h-12.5 w-10" />
            <Skeleton className="size-8 self-center" />
          </div>
        </div>
      </div>
      <div className="grid flex-1 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-4 px-5 py-5 lg:col-span-2">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-16" />
          </div>
          <div className="space-y-3">
            {["task-group-1", "task-group-2"].map((key) => (
              <Skeleton key={key} className="h-26 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="min-w-0 border-t border-border/40 p-5 lg:self-stretch lg:border-t-0 lg:border-l">
          <MonitorSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Static, data-free skeleton of the whole dashboard (client navigation only). */
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      {/* Header band skeleton: greeting + status cluster */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <StatusClusterPlaceholder />
      </div>

      <StatTilesPlaceholder />

      <div className="grid gap-6">
        <div className="panel-hero">
          <div className="space-y-2 border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
          <TimerConsoleBodyPlaceholder />
        </div>

        <div className="panel-hero min-w-0">
          <TaskBoardPlaceholder />
        </div>
      </div>
    </div>
  );
}
