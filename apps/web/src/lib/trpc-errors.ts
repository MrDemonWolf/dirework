import { TRPCClientError } from "@trpc/client";

/** Shown when the API never produced a tRPC error (network failure, HTML/429 body). */
export const API_UNREACHABLE_MESSAGE =
  "Can't reach the Dirework API. Check your connection and try again.";

/** Stable sonner id so repeated transport failures replace one toast instead of stacking. */
export const API_UNREACHABLE_TOAST_ID = "api-unreachable";

/**
 * True when the error came back from a tRPC procedure (it carries the server's
 * error shape). Anything else is a transport failure: fetch rejected, or the
 * response wasn't tRPC JSON (an outage page, a rate-limit body), whose raw
 * message is a JSON-parse error that means nothing to the streamer.
 */
export function isServerTrpcError(err: unknown): err is TRPCClientError<never> {
  return err instanceof TRPCClientError && err.shape != null;
}

/** A user-facing message for a failed tRPC call. */
export function describeTrpcError(err: unknown): string {
  return isServerTrpcError(err) ? err.message : API_UNREACHABLE_MESSAGE;
}
