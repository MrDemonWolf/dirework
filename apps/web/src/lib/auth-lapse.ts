// A lapsed sign-in on an open dashboard. The Better Auth session can end while the page stays
// open (signed out in another tab, a revoked session, a rotated BETTER_AUTH_SECRET), and so can
// the session of an edge sign-in wall in front of /rpc (Cloudflare Access). Every authenticated
// call is refused from then on, yet the dashboard kept polling: each refused poll went out four
// times, raised a new toast and started over a cycle later (up to about 2,500 Worker requests
// an hour), and an Access lapse read as "Can't reach the DireWork API".
//
// Now the /rpc client marks the page lapsed on the first refusal: dashboardPollInterval
// (poll-intervals.ts) stops every poll, reads are answered here without being sent, and one
// toast that stays up offers Reload (query-error-toast.ts). The reload passes the sign-in wall
// and requireSession again, so a signed-out owner lands on the home page. Nothing polls in the
// meantime to notice a session coming back, so the lapse lasts until that reload.

import type { TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";

import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";

import { withRequestTimeout } from "@/lib/fetch-timeout";

/** The lapse toast's title; also what a refused write's own toast says went wrong. */
export const AUTH_LAPSED_MESSAGE = "Your sign-in expired";

/** Stable sonner id: every refusal updates the one lapse toast instead of stacking another. */
export const AUTH_LAPSED_TOAST_ID = "auth-lapsed";

/** Thrown by `fetchRpc` when an edge sign-in wall answered /rpc instead of the api. */
export class AuthLapsedError extends Error {
  constructor() {
    super(AUTH_LAPSED_MESSAGE);
    this.name = "AuthLapsedError";
  }
}

// Page-level state, like the poll cadence's activity clock: it lives as long as the page.
let lapsed = false;

/** True once an /rpc call came back signed out; stays true until the page reloads. */
export function isAuthLapsed(): boolean {
  return lapsed;
}

/** Record the lapse. A no-op on the server, where one isolate serves many requests. */
export function markAuthLapsed(): void {
  if (typeof window !== "undefined") lapsed = true;
}

/**
 * Whether a failed call means the page's sign-in is gone: a procedure refused the session
 * (UNAUTHORIZED) or the owner check (FORBIDDEN), or `fetchRpc` met a sign-in wall. The tRPC
 * code is read structurally (`data.code` on a TRPCClientError), like `classifyBotError`.
 */
export function isAuthLapseError(err: unknown): boolean {
  if (err instanceof AuthLapsedError) return true;
  if (typeof err !== "object" || err === null) return false;
  const { cause, data } = err as { cause?: unknown; data?: { code?: unknown } | null };
  return (
    cause instanceof AuthLapsedError || data?.code === "UNAUTHORIZED" || data?.code === "FORBIDDEN"
  );
}

/**
 * The HTTP status a failed call came back with: the procedure's own (`data.httpStatus`, set by
 * the api's error formatter), else the response's, for a JSON answer that isn't a tRPC error
 * (the api's rate limiter answers 429 `{ error }`).
 */
function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { data, meta } = err as {
    data?: { httpStatus?: unknown } | null;
    meta?: { response?: { status?: unknown } };
  };
  const status = data?.httpStatus ?? meta?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/** A 4xx answer: the same request would be refused again, so a retry only spends requests. */
export function isClientError(err: unknown): boolean {
  const status = httpStatusOf(err);
  return status !== undefined && status >= 400 && status < 500;
}

/** Retries of a failed query after its first attempt (React Query's default is 3). */
export const QUERY_RETRIES = 2;

/**
 * The browser's React Query `retry` (utils/trpc.ts). React Query asks with how many attempts
 * have failed so far, minus one (0 after the first), so a network failure or a 5xx is tried
 * three times in all, 1 s and then 2 s apart, and a 4xx or a lapsed sign-in once.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < QUERY_RETRIES && !isClientError(error) && !isAuthLapseError(error);
}

/**
 * The /rpc client's fetch: the session cookie, the request time box, and no redirect following.
 * tRPC and the web proxy never redirect /rpc, so a redirect there is an edge sign-in wall whose
 * login page is on another origin. Followed, it failed CORS and every poll and button said
 * "Can't reach the DireWork API". Not followed, the browser hands back an opaque redirect
 * (status 0, no body), reported here as the lapse it is.
 */
export async function fetchRpc(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    redirect: "manual",
    signal: withRequestTimeout(init?.signal),
  });
  // Other runtimes return the 3xx itself rather than an opaque redirect.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new AuthLapsedError();
  }
  return res;
}

/**
 * The /rpc client's first link. It marks the lapse as soon as a call comes back signed out,
 * before React Query handles the failure: React Query re-reads every observer's
 * `refetchInterval` while it records an error, ahead of the cache's onError, so this is what
 * makes the refused poll the last one. Once lapsed it answers reads itself, unsent (another
 * poll's timer already running, a tab-focus refetch, a retry button). Writes still go out, so
 * a draft can be saved after signing in again in another tab.
 */
export function authLapseLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return () =>
    ({ op, next }) =>
      observable((observer) => {
        if (lapsed && op.type === "query") {
          observer.error(TRPCClientError.from(new AuthLapsedError()));
          return;
        }
        return next(op).subscribe({
          next: (result) => observer.next(result),
          error: (err) => {
            if (isAuthLapseError(err)) markAuthLapsed();
            observer.error(err);
          },
          complete: () => observer.complete(),
        });
      });
}
