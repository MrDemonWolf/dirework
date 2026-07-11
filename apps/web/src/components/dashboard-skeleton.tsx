import { Skeleton } from "@/components/ui/skeleton";

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
        {/* Timer hero skeleton */}
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
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
            {/* Timer monitor + URL column, matching the live hero's third rail */}
            <div className="w-full space-y-2 lg:w-72 lg:shrink-0 lg:border-l lg:border-border/40 lg:pl-6">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        </div>

        {/* Task board skeleton */}
        <div className="panel min-w-0 lg:col-span-2">
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
          <div className="space-y-4 px-5 py-5">
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Tasks output skeleton — single monitor + URL, matching the live panel */}
        <div className="panel min-w-0">
          <div className="space-y-2 border-b border-border/40 px-5 pt-4 pb-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="space-y-2 px-5 py-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-9 w-full" />
          </div>
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
