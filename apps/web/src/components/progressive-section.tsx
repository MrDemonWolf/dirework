"use client";

// One progressively loaded section of a page: it renders as soon as its own queries have
// data, and shows a placeholder shaped like it until then. The page streams its queries with
// `streamQueries` (lib/server-query.ts) and holds its first paint for at most
// `SECTIONS_READY_MS`, so a section only ever shows its placeholder when its data is slower
// than that. The rules are in lib/progressive.ts.

import { Suspense, use, type ReactNode } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { sectionWait } from "@/lib/progressive";

/**
 * Marks a section's data-shaped placeholder blocks: decorative, so hidden from assistive
 * tech, and named on `data-placeholder` for the e2e suite. Static chrome a fallback repeats
 * (a heading, the greeting) stays outside it. `className` sizes the wrapper where the live
 * section is a flex item that sizes itself (e.g. `w-full` in a centered column).
 */
export function SectionPlaceholder({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-placeholder={name} className={className} aria-hidden>
      {children}
    </div>
  );
}

function SectionGate({
  queryKeys,
  children,
}: {
  queryKeys: readonly QueryKey[];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  for (const pending of sectionWait(queryClient, queryKeys).pending) use(pending);
  return children;
}

/**
 * Render `children` once `queryKeys` have settled (data, or an error the children show
 * themselves), with `fallback` in the meantime. `fallback` must be shaped exactly like the
 * finished section, so nothing jumps when it fills in.
 */
export function ProgressiveSection({
  queryKeys,
  fallback,
  children,
}: {
  queryKeys: readonly QueryKey[];
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <SectionGate queryKeys={queryKeys}>{children}</SectionGate>
    </Suspense>
  );
}
