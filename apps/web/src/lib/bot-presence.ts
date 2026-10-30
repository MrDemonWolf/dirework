// When the dashboard re-checks "Bot connected". `user.me` carries the bot page's last
// check-in as an age; a running page renews its lease every 2 minutes without telling the
// dashboard, so the chip can't go offline on the local clock. Instead, when the lease in
// the last answer would have run out, the dashboard refetches `user.me` ONCE (tab visible
// only) and the fresh answer decides; the next check is scheduled from it, never sooner than
// BOT_LEASE_TTL_MS after the previous one. So while a bot runs and the dashboard is visible
// this costs about one `user.me` refetch per 5 minutes (two Worker requests: web proxy +
// api), and nothing while no bot page holds the lease or the tab is hidden. React-free, so
// it is tested with fake timers.

import { BOT_LEASE_TTL_MS } from "@dirework/api/bot-lease";

import { botPageLiveAtFetch } from "./bot-status";

export interface BotPresenceInput {
  /** `user.me`'s `botPageSeenMsAgo`: the lease's age when the api answered, or null. */
  seenMsAgo: number | null | undefined;
  /** When that answer arrived (React Query's `dataUpdatedAt`), on this browser's clock. */
  fetchedAt: number;
  /** When this dashboard last re-checked (a timestamp, or -Infinity before the first). */
  lastCheckAt: number;
  now: number;
}

/**
 * Milliseconds until the next re-check, or null when none is needed (the last answer
 * already said no bot page holds the lease). Ages, not timestamps: the api and browser
 * clocks never meet.
 */
export function nextBotPresenceCheckMs({
  seenMsAgo,
  fetchedAt,
  lastCheckAt,
  now,
}: BotPresenceInput): number | null {
  if (!botPageLiveAtFetch(seenMsAgo)) return null;
  const leaseRunsOutAt = fetchedAt + (BOT_LEASE_TTL_MS - (seenMsAgo ?? 0));
  return Math.max(0, Math.max(leaseRunsOutAt, lastCheckAt + BOT_LEASE_TTL_MS) - now);
}

export interface BotPresenceCheckOptions {
  seenMsAgo: number | null | undefined;
  fetchedAt: number;
  /** Read and written by the scheduler: the dashboard's last re-check time. */
  lastCheck: { current: number };
  refetch: () => unknown;
  /** Run the scheduler again (the hook bumps a counter); used after a failed refetch. */
  rerun: () => void;
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  now?: () => number;
}

/**
 * Arm the next re-check for one `user.me` answer. Returns its cleanup. A new answer (the
 * refetch landing) re-arms from the fresh value; a refetch that fails leaves the answer as
 * it was, so the scheduler looks again one lease window later. A hidden tab waits for
 * `visibilitychange` instead of fetching.
 */
export function scheduleBotPresenceCheck({
  seenMsAgo,
  fetchedAt,
  lastCheck,
  refetch,
  rerun,
  doc = document,
  now = Date.now,
}: BotPresenceCheckOptions): () => void {
  const delay = nextBotPresenceCheckMs({
    seenMsAgo,
    fetchedAt,
    lastCheckAt: lastCheck.current,
    now: now(),
  });
  if (delay === null) return () => {};

  const onVisible = () => {
    if (doc.visibilityState === "visible") rerun();
  };
  let timer = setTimeout(() => {
    if (doc.visibilityState !== "visible") {
      doc.addEventListener("visibilitychange", onVisible);
      return;
    }
    lastCheck.current = now();
    void refetch();
    timer = setTimeout(rerun, BOT_LEASE_TTL_MS);
  }, delay);
  return () => {
    clearTimeout(timer);
    doc.removeEventListener("visibilitychange", onVisible);
  };
}
