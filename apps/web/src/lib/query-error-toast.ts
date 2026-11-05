import type { Query } from "@tanstack/react-query";
import { toast } from "sonner";

import { AUTH_LAPSED_MESSAGE, AUTH_LAPSED_TOAST_ID, isAuthLapseError } from "@/lib/auth-lapse";
import { API_UNREACHABLE_TOAST_ID, describeTrpcError, isServerTrpcError } from "@/lib/trpc-errors";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /**
       * Never toast this query's failures. For unattended surfaces (OBS
       * overlays) where a toast would be composited onto the live stream and
       * the last good payload is kept on screen instead.
       */
      silent?: boolean;
    };
  }
}

/**
 * The one toast for a lapsed sign-in (lib/auth-lapse.ts). It stays up until the owner acts on
 * it, and each later refusal updates it in place. Reload runs the server's session check (and
 * any edge sign-in wall) again; a signed-out owner lands on the home page.
 */
export function toastAuthLapsed(): void {
  toast.error(AUTH_LAPSED_MESSAGE, {
    id: AUTH_LAPSED_TOAST_ID,
    description: "The dashboard stopped updating. Reload to sign in again.",
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

/**
 * Global QueryCache error handler: toast with a retry action unless silenced. A lapsed sign-in
 * gets the one reload toast instead (a retry can't succeed). Each failing query replaces its own
 * toast (the id is its query hash) and transport failures share one, so a poll that keeps
 * failing never stacks a new toast every cycle.
 */
export function toastQueryError(
  error: Error,
  query: Pick<Query<unknown, Error, unknown, readonly unknown[]>, "meta" | "fetch" | "queryHash">,
): void {
  if (query.meta?.silent) return;
  if (isAuthLapseError(error)) {
    toastAuthLapsed();
    return;
  }
  toast.error(describeTrpcError(error), {
    id: isServerTrpcError(error) ? `query-error:${query.queryHash}` : API_UNREACHABLE_TOAST_ID,
    action: {
      label: "retry",
      // A bound call that refetches now. `query.invalidate` would lose its
      // receiver when passed bare, and only marks the query stale anyway. A
      // failed retry is reported by this same handler, so swallow it here.
      onClick: () => {
        query.fetch().catch(() => undefined);
      },
    },
  });
}

/**
 * Global MutationCache error handler: a write refused because the sign-in lapsed also raises
 * the reload toast. The mutation's own onError still says what didn't happen.
 */
export function toastMutationAuthLapse(error: Error): void {
  if (isAuthLapseError(error)) toastAuthLapsed();
}
