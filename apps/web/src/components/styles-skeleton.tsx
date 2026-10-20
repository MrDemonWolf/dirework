// Loading placeholder for the Theme Center. Shown by the route's loading.tsx the moment a
// navigation starts, and by the page itself until `config.get` resolves. Its blocks mirror the
// live layout (header band, preset rail, editor column + preview) so nothing jumps when data
// lands; update it alongside styles-page.tsx.

import { Skeleton } from "@/components/ui/skeleton";

/** Static, data-free skeleton of the Theme Center. */
export function StylesSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Preset rail skeleton */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-3 w-16" />
        <div className="flex gap-3 overflow-hidden p-1">
          {["preset-1", "preset-2", "preset-3", "preset-4", "preset-5"].map((key) => (
            <Skeleton key={key} className="h-32 w-36 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Editor + preview column skeleton */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 space-y-3 lg:w-[380px] lg:shrink-0">
          <Skeleton className="h-9 w-40" />
          {["editor-1", "editor-2", "editor-3", "editor-4"].map((key) => (
            <Skeleton key={key} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[560px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
