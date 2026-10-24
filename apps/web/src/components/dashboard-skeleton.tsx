// Loading placeholder for the dashboard page. A hard load streams the finished page (the
// server prefetches its data), so this shows only on client navigation (dashboard/loading.tsx,
// while the next page's server render round-trips) and as the fallback when the server
// prefetch failed and `user.me` is fetching in the browser. Its blocks mirror the live layout
// (header chips, timer console 3/5 | 2/5, task board 2/3 | monitor 1/3) so the page doesn't
// jump when data lands; update it alongside dashboard.tsx, timer-controls.tsx and
// task-manager.tsx.

import { Skeleton } from "@/components/ui/skeleton";

/** An overlay monitor with its preview off: rule + size chip, URL row, hint + toggle. */
function MonitorSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

/** Static, data-free skeleton of the dashboard grid. */
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      {/* Header band skeleton: greeting + timer status and bot chips */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      <div className="stagger-reveal grid gap-6">
        {/* Timer console: instrument (3/5) | transport, settings summary, monitor (2/5) */}
        <div className="panel-hero">
          <div className="space-y-2 border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid lg:grid-cols-5">
            <div className="flex flex-col items-center justify-center gap-5 px-5 py-8 lg:col-span-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-20 w-64" />
              <Skeleton className="h-1.5 w-64 rounded-full" />
              <Skeleton className="h-2 w-20" />
            </div>
            <div className="flex flex-col gap-5 border-t border-border/40 px-5 py-5 lg:col-span-2 lg:border-t-0 lg:border-l">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <MonitorSkeleton />
            </div>
          </div>
        </div>

        {/* Task board: header band; form + groups (2/3) | tasks monitor (1/3) */}
        <div className="panel-hero min-w-0">
          <div className="border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-24" />
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex items-end gap-5">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10" />
                <Skeleton className="size-8 self-center" />
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-3">
            <div className="min-w-0 space-y-4 px-5 py-5 lg:col-span-2">
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-16" />
              </div>
              <div className="space-y-3">
                {["task-group-1", "task-group-2"].map((key) => (
                  <Skeleton key={key} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="border-t border-border/40 p-5 lg:border-t-0 lg:border-l">
              <MonitorSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
