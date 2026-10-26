// Progressive sections: a page's data streams from ONE server batch and each section of the
// page fills in as its own results arrive (lib/server-query.ts `streamQueries`, rendered by
// components/progressive-section.tsx). This module is the React-free timing logic, so it is
// unit-tested directly.
//
// The placeholder delay lives on the server, not in CSS. React reveals streamed Suspense
// boundaries in batches: the first one right away, every later one no sooner than 300ms after
// the previous reveal. So a frame that paints first and fills in a moment later still shows
// its placeholders for ~300ms, even when every query lands 20ms in (measured: the old
// dashboard always did; a frame-first build did 2 loads in 8). Instead the page holds its
// first paint until every query has settled or `SECTIONS_READY_MS` has passed, whichever is
// first:
//  - fast load: one paint, complete. No placeholder is ever rendered.
//  - slow load: the paint at the deadline carries every section that made it plus a
//    placeholder for each one still in flight, and each of those fills in on its own.
// That is a delayed fallback (a placeholder only for data slower than the deadline) that
// React's reveal throttle cannot defeat.
//
// Why 800ms and not less: a partial first paint never finishes the page sooner. Its
// placeholders stay up for at least the 300ms throttle, so a batch that lands just after the
// deadline still completes ~300ms after the partial frame, later than holding would have. And
// a production batch is slower than it looks locally: the api answers it after the session
// read plus each procedure's D1 reads, ~45ms a round trip from the edge (`/ready` minus
// `/health`), more on a cold isolate. At the old 150ms most real loads missed the deadline
// and painted every section as a placeholder (measured with every procedure slowed 160ms:
// 3 of 3 hard loads partial, complete at ~510ms). 800ms keeps first paint, session check
// included, inside the ~1s that still reads as one uninterrupted step, and only an api
// that slow shows placeholders, the honest signal that it is slow.

import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** First-paint deadline: sections whose data is slower show a placeholder and stream in. */
export const SECTIONS_READY_MS = 800;

/**
 * Resolves when every promise in `work` has settled (resolved or rejected) or after `ms`,
 * whichever comes first; never rejects. The timer is cleared as soon as the work wins, so a
 * fast render leaves nothing behind.
 */
export function sectionsReady(
  work: readonly Promise<unknown>[],
  ms: number = SECTIONS_READY_MS,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void Promise.allSettled(work).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** A promise React's `use()` reads synchronously once it carries `status: "fulfilled"`. */
type TrackedThenable = Promise<void> & { status?: "pending" | "fulfilled" };

const settledThenables = new WeakMap<Promise<unknown>, TrackedThenable>();

/**
 * One stable "settled" thenable per query fetch: it resolves (never rejects) when the fetch
 * settles either way, and carries React's `status` field, so a re-render after it settled
 * reads it without suspending again. A failed query must not throw from the gate: the section
 * then renders and its components show their own error state (React Query refetches it on
 * mount, as it did after a failed awaited prefetch).
 */
function settledThenable(promise: Promise<unknown>): Promise<void> {
  let thenable = settledThenables.get(promise);
  if (!thenable) {
    const created: TrackedThenable = promise.then(
      () => {
        created.status = "fulfilled";
      },
      () => {
        created.status = "fulfilled";
      },
    );
    created.status = "pending";
    thenable = created;
    settledThenables.set(promise, thenable);
  }
  return thenable;
}

/** What a section still waits for. */
export interface SectionWait {
  /** In-flight fetches of this section's queries, as stable `use()`-able thenables. */
  pending: Promise<void>[];
}

/**
 * The fetches a section must wait for: those of its queries that have no data and are still
 * fetching. A query with data (a warm cache on a client navigation), one that already failed,
 * or one with no cache entry (nothing streamed it; its components fetch it) never holds a
 * section back.
 */
export function sectionWait(queryClient: QueryClient, queryKeys: readonly QueryKey[]): SectionWait {
  const pending: Promise<void>[] = [];
  for (const queryKey of queryKeys) {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (!query || query.state.data !== undefined) continue;
    if (query.state.status === "pending" && query.promise) {
      pending.push(settledThenable(query.promise));
    }
  }
  return { pending };
}
