// Loading placeholder for the Theme Center, shown by the route's loading.tsx the moment a
// client-side navigation starts (a hard load streams the page finished instead, see
// lib/shell-hold.ts). React keeps a shown fallback up for at least ~300ms, so its blocks
// mirror the live layout box for box: header band, the 2 / 3 / 6-column preset grid, then the
// preview (a collapsed sticky bar below lg, the 24rem rail at lg) beside the editor (rule, tab
// strip, the open Colors section and three collapsed ones). Update it with styles-page.tsx.

import { Skeleton } from "@/components/ui/skeleton";

const PRESETS = ["p1", "p2", "p3", "p4", "p5", "p6"];
const COLLAPSED_SECTIONS = ["typography", "layout", "opacity"];

/** Static, data-free skeleton of the Theme Center. */
export function StylesSkeleton() {
  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      {/* Header band: rule, title + options button, two-line subtitle on a phone */}
      <div className="mb-6">
        <Skeleton className="h-3 w-28" />
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="size-9 shrink-0" />
        </div>
      </div>

      {/* Preset grid: same columns and card height as ThemeBrowser */}
      <div className="mb-6">
        <Skeleton className="mb-3 h-3 w-40" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PRESETS.map((key) => (
            <Skeleton key={key} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Preview + editor, in the page's order (preview first, a right-hand rail at lg) */}
      <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-6">
        <Skeleton className="h-14 w-full rounded-2xl lg:h-116 lg:w-96 lg:shrink-0" />
        <div className="w-full min-w-0 space-y-3 lg:flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-88 w-full" />
          {COLLAPSED_SECTIONS.map((key) => (
            <Skeleton key={key} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
