/**
 * Structured, redacted telemetry (P2.17).
 *
 * Cloudflare Workers observability ingests stdout, so "emitting a metric" here
 * means writing one well-shaped JSON line. Everything goes through these helpers
 * rather than ad-hoc console.log so the redaction contract holds in one place:
 * a fixed field set, no free-form interpolation of request data, and never a
 * token, credential, OAuth parameter, chat message, or task title.
 */

/** Countable events worth alerting on. Keep this list closed — no free strings. */
export type MetricName =
  | "oauth.failure"
  | "token.refresh.failure"
  | "token.refresh.success"
  | "bot.reconnect"
  | "ratelimit.rejected"
  | "ratelimit.failure"
  | "timer.conflict"
  | "db.error"
  | "internal.error"
  | "upstream.timeout";

export interface MetricEvent {
  type: "metric";
  metric: MetricName;
  /** Correlates with the x-request-id header and the request log line. */
  requestId?: string;
  /** Bounded, non-identifying dimension (e.g. a bucket name or failure reason). */
  label?: string;
  count: number;
}

/**
 * Only values from a closed set may become a label — never a caught error's
 * message, which can carry a URL, a token, or user text.
 */
const LABEL_PATTERN = /^[a-z0-9_.:-]{1,40}$/i;

export function buildMetric(
  metric: MetricName,
  opts: { requestId?: string; label?: string; count?: number } = {},
): MetricEvent {
  const label = opts.label && LABEL_PATTERN.test(opts.label) ? opts.label : undefined;
  return {
    type: "metric",
    metric,
    ...(opts.requestId ? { requestId: opts.requestId } : {}),
    ...(label ? { label } : {}),
    count: opts.count ?? 1,
  };
}

export function recordMetric(
  metric: MetricName,
  opts: { requestId?: string; label?: string; count?: number } = {},
): void {
  console.log(JSON.stringify(buildMetric(metric, opts)));
}

export interface ErrorEvent {
  type: "error";
  requestId?: string;
  /** Pathname only — never the query string. */
  path?: string;
  /** Error constructor name, e.g. "TRPCError" — safe, non-identifying. */
  name: string;
  /** Present only for errors we classify ourselves; never a raw message. */
  reason?: string;
}

/**
 * Build a redacted error record. Deliberately drops `error.message` and the
 * stack: a D1 error echoes SQL (which can contain task text), a fetch error
 * echoes the URL (which can contain an OAuth code), and stacks leak paths.
 * The request id is what ties this to the full request log line.
 */
export function buildErrorEvent(opts: {
  error: unknown;
  requestId?: string;
  url?: string;
  reason?: string;
}): ErrorEvent {
  const rawName =
    opts.error instanceof Error && typeof opts.error.name === "string"
      ? opts.error.name
      : "UnknownError";
  const name = LABEL_PATTERN.test(rawName) ? rawName : "Error";
  const reason = opts.reason && LABEL_PATTERN.test(opts.reason) ? opts.reason : undefined;
  return {
    type: "error",
    ...(opts.requestId ? { requestId: opts.requestId } : {}),
    ...(opts.url ? { path: new URL(opts.url).pathname } : {}),
    name,
    ...(reason ? { reason } : {}),
  };
}

export function recordError(opts: {
  error: unknown;
  requestId?: string;
  url?: string;
  reason?: string;
}): void {
  console.error(JSON.stringify(buildErrorEvent(opts)));
}
