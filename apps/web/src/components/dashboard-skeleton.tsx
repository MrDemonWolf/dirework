// Loading placeholder for the dashboard page. A hard load streams the finished page (the
// server prefetches its data), so this shows only on client navigation (dashboard/loading.tsx,
// while the next page's server render round-trips) and as the fallback when the server
// prefetch failed and `user.me` is fetching in the browser. Its blocks mirror the live layout
// (timer hero, task hero, bot strip) so the page doesn't jump when data lands; update it
// alongside dashboard.tsx and task-manager.tsx.

import { Skeleton } from "@/components/ui/skeleton";

/** Bottom overlay-URL strip shared by both heroes. */
function UrlStripSkeleton() {
  return (
    <div className="space-y-2 border-t border-border/40 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-3 w-56" />
    </div>
  );
}

/** Static, data-free skeleton of the dashboard grid. */
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header band skeleton */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="stagger-reveal grid items-start gap-6 lg:grid-cols-3">
        {/* Timer hero skeleton: clock | settings rail | preview rail, URL strip below */}
        <div className="panel-hero lg:col-span-3">
          <div className="space-y-2 border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-col gap-8 px-5 py-6 lg:flex-row lg:items-stretch">
            <div className="flex flex-1 flex-col items-center justify-center gap-5 py-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-20 w-64" />
              <Skeleton className="h-1.5 w-64 rounded-full" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-12 w-40" />
            </div>
            <div className="w-full space-y-3 lg:w-60 lg:shrink-0 lg:border-l lg:border-border/40 lg:pl-6">
              <Skeleton className="h-3 w-16" />
              {[
                "timer-setting-1",
                "timer-setting-2",
                "timer-setting-3",
                "timer-setting-4",
                "timer-setting-5",
              ].map((key) => (
                <Skeleton key={key} className="h-8 w-full" />
              ))}
            </div>
            <div className="w-full space-y-2 lg:w-72 lg:shrink-0 lg:border-l lg:border-border/40 lg:pl-6">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="aspect-square w-full rounded-xl" />
            </div>
          </div>
          <UrlStripSkeleton />
        </div>

        {/* Task hero skeleton: header band; form + groups left, preview rail right; URL strip */}
        <div className="panel-hero min-w-0 lg:col-span-3">
          <div className="border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-24" />
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-5">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-4 px-5 py-5">
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
            <div className="w-full space-y-2 border-t border-border/40 p-5 lg:w-72 lg:shrink-0 lg:border-t-0 lg:border-l">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="aspect-square w-full rounded-xl" />
            </div>
          </div>
          <UrlStripSkeleton />
        </div>

        {/* Bot quick status skeleton — slim full-width strip like the live section */}
        <div className="panel lg:col-span-3">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
