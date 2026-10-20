// Route-level loading UI for the public pages of the (app) group (`/`, `/setup`): shown the
// instant a navigation starts, while the page's session and ownership checks round-trip to
// the api worker. The dashboard routes carry their own loading.tsx, which Next prefers.
// Mirrors the hero's two-column shape so the page doesn't jump when it lands.

import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <section className="flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:justify-between lg:gap-6">
        <div className="flex w-full max-w-xl flex-col items-center gap-6 lg:items-start">
          <Skeleton className="h-7 w-48 rounded-full" />
          <Skeleton className="h-14 w-full max-w-md" />
          <Skeleton className="h-6 w-full max-w-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <Skeleton className="h-64 w-full max-w-sm rounded-2xl lg:w-80" />
      </section>
    </div>
  );
}
