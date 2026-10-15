/**
 * Polling cadences. Every poll is a Worker request against the Cloudflare
 * free-tier daily budget, so retune these here, never inline.
 *
 * Overlays poll even in the background (OBS sources are never "visible");
 * dashboard queries stop when the tab is hidden, and slow to
 * DASHBOARD_IDLE_POLL_MS while the tab is visible but nobody has touched it
 * for DASHBOARD_IDLE_AFTER_MS. A dashboard request is billed twice (the web
 * worker proxies /rpc to the api worker), so a dashboard left open on a second
 * monitor used to cost more than both overlays combined.
 */
export const OVERLAY_POLL_MS = 3000;
export const DASHBOARD_TASKS_POLL_MS = 3000;
export const DASHBOARD_TIMER_POLL_MS = 2000;
export const DASHBOARD_IDLE_AFTER_MS = 2 * 60_000;
export const DASHBOARD_IDLE_POLL_MS = 15_000;

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

let lastActivityAt = Date.now();
let trackingActivity = false;

function trackActivity(): void {
  if (trackingActivity || typeof window === "undefined") return;
  trackingActivity = true;
  const mark = () => {
    lastActivityAt = Date.now();
  };
  for (const name of ACTIVITY_EVENTS) {
    window.addEventListener(name, mark, { capture: true, passive: true });
  }
}

/** The poll interval for an active cadence, slowed once the owner has been idle. */
export function idleAwareInterval(activeMs: number, now: number, lastActivity: number): number {
  return now - lastActivity >= DASHBOARD_IDLE_AFTER_MS
    ? Math.max(activeMs, DASHBOARD_IDLE_POLL_MS)
    : activeMs;
}

/**
 * A React Query `refetchInterval` function: `activeMs` while the owner is
 * interacting, DASHBOARD_IDLE_POLL_MS after DASHBOARD_IDLE_AFTER_MS without
 * input. Re-evaluated after every fetch, so the first poll after the owner
 * comes back can lag by up to one idle interval; their own actions invalidate
 * the queries immediately.
 */
export function dashboardPollInterval(activeMs: number): () => number {
  return () => {
    trackActivity();
    return idleAwareInterval(activeMs, Date.now(), lastActivityAt);
  };
}

/**
 * Shared by every `timer.get` observer on the dashboard. React Query polls a key
 * at the fastest interval among its observers, so they must stay identical.
 * The countdown ticks locally from targetEndTime; the poll only syncs state.
 */
export const DASHBOARD_TIMER_QUERY_OPTS = {
  refetchInterval: dashboardPollInterval(DASHBOARD_TIMER_POLL_MS),
  refetchOnWindowFocus: false,
} as const;
