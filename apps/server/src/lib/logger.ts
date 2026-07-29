import type { MiddlewareHandler } from "hono";

/**
 * Structured, redacted request logging. Replaces hono/logger, which — while it
 * only logs the pathname today — is a stringly-typed console line with no
 * redaction contract. This logs an explicit, fixed field set and NEVER touches
 * the query string, headers, or body, so OAuth codes/state, session values, and
 * bot/overlay tokens (all of which ride in query params or headers) can never
 * leak into logs. The request id also feeds correlation (x-request-id header).
 */
export interface RequestLog {
  id: string;
  method: string;
  /** Pathname ONLY — query string is intentionally dropped. */
  path: string;
  status: number;
  ms: number;
}

/**
 * Build the log record from a raw request URL. The whole point is that only the
 * pathname survives — `new URL(url).pathname` strips `?code=…&state=…` etc.
 */
export function buildRequestLog(opts: {
  id: string;
  method: string;
  url: string;
  status: number;
  ms: number;
}): RequestLog {
  return {
    id: opts.id,
    method: opts.method,
    path: new URL(opts.url).pathname,
    status: opts.status,
    ms: opts.ms,
  };
}

/** Context key holding the current request id, for correlated telemetry. */
export const REQUEST_ID_KEY = "requestId";

/** Read the current request id, if the logger middleware has run. */
export function getRequestId(c: { get: (key: string) => unknown }): string | undefined {
  const id = c.get(REQUEST_ID_KEY);
  return typeof id === "string" ? id : undefined;
}

export const requestLogger = (): MiddlewareHandler => async (c, next) => {
  const id = crypto.randomUUID();
  const start = Date.now();
  c.header("x-request-id", id);
  // Stash on the context too: downstream middleware needs the id BEFORE a
  // response exists, so reading it back off c.res would be too late (and, in
  // Hono, forces a placeholder Response into existence).
  c.set(REQUEST_ID_KEY, id);

  await next();

  const log = buildRequestLog({
    id,
    method: c.req.method,
    url: c.req.url,
    status: c.res.status,
    ms: Date.now() - start,
  });
  console.log(JSON.stringify(log));
};
