import type { TRPCError } from "@trpc/server";

import { getRequestId } from "./logger";
import { recordError, recordMetric } from "./telemetry";

/**
 * Build the tRPC `onError` hook for one request. tRPC handles its own errors,
 * so they never reach app.onError — this is the only place procedure failures
 * can be counted.
 *
 * It closes over the Hono context rather than reading the tRPC ctx, because a
 * createContext failure (e.g. a D1 outage during session lookup) runs onError
 * with no ctx — exactly the failure that most needs a request id.
 *
 * Only closed-set values become fields: the tRPC code, the procedure path, and
 * the underlying error's NAME. The message never does, since it can carry task
 * text, SQL, or a Twitch response body.
 */
export function trpcErrorReporter(c: { get: (key: string) => unknown; req: { url: string } }) {
  return ({ error, path }: { error: TRPCError; path?: string }) => {
    // Expected auth and validation failures are client outcomes, not database
    // incidents. Logging them as errors created noisy, attacker-amplifiable
    // telemetry and obscured real server failures.
    if (error.code !== "INTERNAL_SERVER_ERROR") return;
    const requestId = getRequestId(c);
    recordMetric("internal.error", { requestId, label: error.code });
    recordError({
      // A thrown non-tRPC error is wrapped as the cause; its name (D1Error,
      // TypeError, …) is what separates an outage from a code bug.
      error: error.cause ?? error,
      requestId,
      url: c.req.url,
      reason: path ?? error.code,
    });
  };
}
