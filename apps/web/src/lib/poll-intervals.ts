import { isAuthLapsed } from "@/lib/auth-lapse";

/**
 * Polling cadences. Every poll is a Worker request against the Cloudflare
 * free-tier daily budget, so retune these here, never inline, and keep each
 * one's request count in its comment.
 *
 * Overlays poll even in the background (OBS sources are never "visible"),
 * except the dashboard's live preview of one (OVERLAY_POLL_QUERY_OPTS);
 * dashboard queries stop when the tab is hidden, and slow to
 * DASHBOARD_IDLE_POLL_MS while the tab is visible but nobody has touched it
 * for DASHBOARD_IDLE_AFTER_MS. A dashboard request is billed twice (the web
 * worker proxies /rpc to the api worker), so a dashboard left open on a second
 * monitor used to cost more than both overlays combined. Once the owner's
 * sign-in lapses (lib/auth-lapse.ts), dashboard polls stop for good: every one
 * would be refused until the page reloads. The footer's version check also
 * skips hidden tabs; the bot page's cadences run while it is open.
 */
/**
 * 5s, not 3s: both OBS overlays poll all stream long, even in the background, so
 * this is the largest steady request cost (2 sources x 12/min = ~1.4k requests/hour,
 * down from ~2.4k at 3s; 40% fewer Worker requests and D1 reads). The countdown and
 * ring animate locally from targetEndTime, so the only cost is that a state change
 * (start, pause, a new task) can reach the overlay up to 2s later. Never go faster
 * without a stated request-budget reason.
 */
export const OVERLAY_POLL_MS = 5000;
export const DASHBOARD_TASKS_POLL_MS = 3000;
export const DASHBOARD_TIMER_POLL_MS = 2000;
export const DASHBOARD_IDLE_AFTER_MS = 2 * 60_000;
export const DASHBOARD_IDLE_POLL_MS = 15_000;

/**
 * The footer's new-deploy check (VersionBadge → lib/version-check.ts): one free static-asset
 * revalidation (`/version.json`) per check, with no web-Worker request. Only the owner's tab checks, only while it
 * is visible, and never sooner than this after the previous check (a return to the tab
 * included), so at most 12 an hour, ~96 for an 8-hour stream. A hidden tab, a stale tab and a
 * viewer's tab (/ and /setup) cost nothing. Never faster: a deploy only needs noticing within
 * minutes.
 */
export const VERSION_CHECK_MS = 5 * 60_000;

/**
 * The bot page's chat-lease check-in (`bot.heartbeat`), live or in standby: one Worker
 * request and one D1 write (the renewal) per open bot page every 2 minutes, so 30 an hour
 * and at most 720 a day for a page left open around the clock. Well under the 5-minute lease
 * (BOT_LEASE_TTL_MS in @dirework/api/bot-lease), so one lost check-in never drops a running
 * bot; never longer than half that lease.
 */
export const BOT_HEARTBEAT_MS = 2 * 60_000;

/**
 * The bot page's chat-token check (`bot.getSession({ revalidate: true })`, which also asks
 * Twitch's /oauth2/validate; it reconnects only when the token rotated): one Worker request
 * an hour per running page, so 24 a day for a page open around the clock. A page in standby
 * skips it.
 */
export const REVALIDATE_INTERVAL_MS = 60 * 60_000;

/**
 * A bot page with no bot account connected yet (phase `not-configured`) re-runs
 * `bot.getSession` this often, so it goes live on its own once the streamer connects one:
 * 60 Worker requests an hour (plus their D1 reads), at most 1,440 a day for a page parked in
 * OBS around the clock. The page's "checking every minute" line is built from it.
 */
export const NOT_CONFIGURED_POLL_MS = 60_000;

/**
 * A payload younger than this is reused on mount/tab-focus instead of refetched (hydrated
 * SSR data, back-navigation). `refetchInterval` polls and `invalidateQueries` ignore
 * staleness, so every cadence above is unchanged.
 */
export const QUERY_FRESH_MS = 30_000;

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
 * input, and `false` (no more polls) once the sign-in has lapsed. Re-evaluated
 * after every fetch, so the first poll after the owner comes back can lag by up
 * to one idle interval; their own actions invalidate the queries immediately.
 */
export function dashboardPollInterval(activeMs: number): () => number | false {
  return () => {
    if (isAuthLapsed()) return false;
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

/**
 * Shared by both OBS overlay pages: every OVERLAY_POLL_MS, in the background too (an OBS
 * source is never "visible"), and silent (a failed poll must never toast onto the stream;
 * the last good payload stays up). The dashboard's live preview loads the same pages with
 * `?preview=1`, and they set `refetchIntervalInBackground: !preview` after spreading these:
 * a preview polls on this cadence only while its dashboard tab is visible, skips every tick
 * while it is hidden, and refetches once on return if the payload is older than
 * QUERY_FRESH_MS. That saves up to 720 api requests an hour (plus their D1 reads) per
 * hidden dashboard tab left with the preview on; OBS sources load the plain URL, unchanged.
 */
export const OVERLAY_POLL_QUERY_OPTS = {
  refetchInterval: OVERLAY_POLL_MS,
  refetchIntervalInBackground: true,
  meta: { silent: true },
} as const;
