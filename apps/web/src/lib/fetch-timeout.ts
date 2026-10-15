/**
 * Client-side request time box for tRPC. Without one, a hung response never
 * settles: overlay polls pile up and — worse — the bot page's serial ingest
 * queue waits on that one call forever, so every later chat command stalls.
 */
export const TRPC_REQUEST_TIMEOUT_MS = 30_000;

/** A signal that aborts after `ms` (AbortSignal.timeout, or a timer fallback). */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, ms);
  return controller.signal;
}

/**
 * Combine signals so the result aborts as soon as any input does, carrying
 * that input's reason. Uses AbortSignal.any where available (older Safari and
 * some embedded browsers — OBS's CEF included — may lack it).
 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
  }
  const onAbort = (event: Event) => {
    const source = event.target as AbortSignal;
    for (const signal of signals) signal.removeEventListener("abort", onAbort);
    controller.abort(source.reason);
  };
  for (const signal of signals) signal.addEventListener("abort", onAbort);
  return controller.signal;
}

/** `signal` (tRPC's, for query cancellation) combined with a request time box. */
export function withRequestTimeout(
  signal: AbortSignal | null | undefined,
  ms: number = TRPC_REQUEST_TIMEOUT_MS,
): AbortSignal {
  const timeout = timeoutSignal(ms);
  return signal ? anySignal([signal, timeout]) : timeout;
}
