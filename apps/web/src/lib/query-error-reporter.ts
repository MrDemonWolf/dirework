import type { Query } from "@tanstack/react-query";

// The browser QueryClient's error handlers (utils/query-client.ts, its QueryCache and
// MutationCache) call the reporters registered here instead of importing them, because the
// QueryClient also loads on the OBS overlays and the toast reporters (lib/query-error-toast.ts) bring sonner with them.
// components/app-toaster.tsx registers the toasts as its module loads, and only the (app) layout
// mounts it: the OBS overlays and the bot page show no toasts, so they load neither, and a
// failure there reports nowhere.

/** A failed query's error and the query, as the QueryCache's `onError` receives them. */
export type QueryErrorReporter = (error: Error, query: Query<unknown, unknown, unknown>) => void;

/** A failed mutation's error, as the MutationCache's `onError` receives it first. */
export type MutationErrorReporter = (error: Error) => void;

/** The page's reporters: one for failed queries, one for failed mutations. */
export interface ErrorReporters {
  query: QueryErrorReporter;
  mutation: MutationErrorReporter;
}

// One pair for the page's lifetime, the same on every load. The server registers them too
// (AppToaster's module also loads during SSR), but its QueryClients have no onError to call them.
let reporters: ErrorReporters | undefined;

/**
 * Registers the page's reporters. Call it as a module loads, as app-toaster.tsx does, not in an
 * effect or on the first error: a reporter fetched late would miss a failure that comes first,
 * and could not load at all when the network is what failed.
 */
export function setErrorReporters(next: ErrorReporters): void {
  reporters = next;
}

/**
 * The browser QueryCache's `onError`: hands a failure to the registered reporter, if any. A
 * query marked `meta.silent` (the OBS overlay polls) never reaches it.
 */
export function reportQueryError(error: Error, query: Query<unknown, unknown, unknown>): void {
  if (query.meta?.silent) return;
  reporters?.query(error, query);
}

/** The browser MutationCache's `onError`: hands a failed write to the registered reporter, if any. */
export function reportMutationError(error: Error): void {
  reporters?.mutation(error);
}
