// The dashboard pages' header band (/dashboard, Theme Center, Bot settings): an optional kicker,
// the page's h1, a one-line description, and either compact actions beside the title (Theme
// Center's options menu) or a status cluster that wraps under the header on a phone (the
// dashboard's chips). `PageHeaderSkeleton` draws the same band for the client-navigation
// skeletons, each bar inside its real line box, so the blocks under it never move when the page
// lands. No hooks and no "use client": the not-found page (a server component) reads the title
// class too.

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The page `h1`: one recipe for every full page (36px line box). */
export const PAGE_TITLE_CLASS = "font-heading text-3xl font-bold tracking-tight";

/** The line under the h1 (20px line boxes). */
export const PAGE_DESCRIPTION_CLASS = "mt-1 text-sm text-muted-foreground";

/** The band: the title block, then a status cluster that wraps under it when space runs out. */
const BAND_CLASS = "flex flex-wrap items-end justify-between gap-4";
/** The title block grows to fill its line, so compact actions sit at its top right. */
const TITLE_ROW_CLASS = "flex min-w-0 grow items-start justify-between gap-3";
const STATUS_CLASS = "flex flex-wrap items-center gap-2";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  status,
  className,
  suppressHydrationWarning,
}: {
  /**
   * Above the title, always as a mono `console-label` line (the dashboard's date). Only where it
   * adds something: never the page's own name, which the h1 already says.
   */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Compact controls at the title's top right that never wrap (an icon menu). */
  actions?: ReactNode;
  /** A cluster beside the whole band, bottom-aligned, wrapping under it on a phone. */
  status?: ReactNode;
  /** The band's bottom margin and any extra layout. */
  className?: string;
  /** For copy picked from the browser's clock (the greeting): the server's may differ. */
  suppressHydrationWarning?: boolean;
}) {
  return (
    <div data-slot="page-header" className={cn(BAND_CLASS, className)}>
      <div className={TITLE_ROW_CLASS}>
        <div className="min-w-0">
          {kicker && (
            <p className="console-label mb-2" suppressHydrationWarning={suppressHydrationWarning}>
              {kicker}
            </p>
          )}
          <h1 className={PAGE_TITLE_CLASS} suppressHydrationWarning={suppressHydrationWarning}>
            {title}
          </h1>
          {description && (
            <p
              className={PAGE_DESCRIPTION_CLASS}
              suppressHydrationWarning={suppressHydrationWarning}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {status && <div className={STATUS_CLASS}>{status}</div>}
    </div>
  );
}

/** Where the copy starts to wrap: [hide from it up, hide below it] (literal, for Tailwind). */
const WRAP_BREAKPOINT = {
  sm: ["sm:hidden", "max-sm:hidden"],
  md: ["md:hidden", "max-md:hidden"],
} as const;

type WrapBreakpoint = keyof typeof WRAP_BREAKPOINT;

/**
 * Line boxes as skeleton bars: `lines` from `below` up, `narrow` under it (where the copy
 * wraps). `lineClassName` is the line box; the bar fills 60% of it, like a glyph run.
 */
function LineBoxes({
  lines,
  narrow,
  below,
  lineClassName,
  barClassName,
}: {
  lines: number;
  narrow: number;
  below: WrapBreakpoint;
  lineClassName: string;
  barClassName: string;
}) {
  const count = Math.max(lines, narrow);
  const [hideUp, hideDown] = WRAP_BREAKPOINT[below];
  return Array.from({ length: count }, (_, i) => {
    // Shown only where the copy runs to this many lines.
    const visibility = i >= lines ? hideUp : i >= narrow ? hideDown : "";
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of identical lines
      <div key={i} className={cn("flex items-center", lineClassName, visibility)}>
        <Skeleton className={cn("h-3/5", i === count - 1 ? barClassName : "w-full")} />
      </div>
    );
  });
}

/**
 * The band's placeholder, box for box: an h-4.5 kicker line (12px mono × 1.5) and its mb-2, an
 * h-9 line per title line, then mt-1 and an h-5 line per description line. Counts are per
 * breakpoint (`narrow*` below `wrapsBelow`, `sm` by default), since a narrow screen wraps the
 * copy. `actions` / `status` take the placeholders of the live controls.
 */
export function PageHeaderSkeleton({
  kicker = false,
  titleLines = 1,
  narrowTitleLines = titleLines,
  descriptionLines = 1,
  narrowDescriptionLines = descriptionLines,
  wrapsBelow = "sm",
  actions,
  status,
  className,
}: {
  kicker?: boolean;
  titleLines?: number;
  narrowTitleLines?: number;
  descriptionLines?: number;
  narrowDescriptionLines?: number;
  wrapsBelow?: WrapBreakpoint;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn(BAND_CLASS, className)}>
      {/* A title that wraps on a phone is wider than the line, so the live band puts its status
          on a line of its own there; bars have no width of their own to force that. */}
      <div className={cn(TITLE_ROW_CLASS, status && narrowTitleLines > 1 && "max-sm:basis-full")}>
        <div className="min-w-0 grow">
          {kicker && (
            <div className="mb-2 flex h-4.5 items-center">
              <Skeleton className="h-3 w-32" />
            </div>
          )}
          <LineBoxes
            lines={titleLines}
            narrow={narrowTitleLines}
            below={wrapsBelow}
            lineClassName="h-9"
            barClassName="w-64 max-w-full"
          />
          {descriptionLines > 0 && (
            <div className="mt-1">
              <LineBoxes
                lines={descriptionLines}
                narrow={narrowDescriptionLines}
                below={wrapsBelow}
                lineClassName="h-5"
                barClassName="w-48 max-w-full"
              />
            </div>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {status && <div className={STATUS_CLASS}>{status}</div>}
    </div>
  );
}
