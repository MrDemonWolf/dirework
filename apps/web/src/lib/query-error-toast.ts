import type { Query } from "@tanstack/react-query";
import { toast } from "sonner";

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
 * Global QueryCache error handler: toast with a retry action unless silenced.
 * Transport failures share one toast id so a failing poll replaces the toast
 * instead of stacking a new one every cycle.
 */
export function toastQueryError(
  error: Error,
  query: Pick<Query<unknown, Error, unknown, readonly unknown[]>, "meta" | "invalidate">,
): void {
  if (query.meta?.silent) return;
  toast.error(describeTrpcError(error), {
    id: isServerTrpcError(error) ? undefined : API_UNREACHABLE_TOAST_ID,
    action: {
      label: "retry",
      onClick: query.invalidate,
    },
  });
}
