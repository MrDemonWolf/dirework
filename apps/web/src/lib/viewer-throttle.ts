// Per-viewer command throttle for the browser bot page. Runs BEFORE a chat line
// is relayed to bot.ingest, so a viewer spamming commands costs no Worker
// request and no D1 read past the first few. React-free and clock-injectable,
// so it is tested with fake timers.

/** Dirework commands one viewer may relay per window. */
export const VIEWER_COMMAND_LIMIT = 6;
/** The rolling window the limit counts over. */
export const VIEWER_COMMAND_WINDOW_MS = 30_000;
/**
 * Viewers tracked at once. A raid of new chatters can't grow the map without
 * bound: past this, viewers with no command in the window are forgotten first,
 * then the longest-idle ones.
 */
export const MAX_TRACKED_VIEWERS = 500;

/**
 * - `allowed`: relay the line.
 * - `throttled`: the first line dropped in this burst (log it once).
 * - `dropped`: a later line in the same burst (drop it quietly).
 */
export type ThrottleVerdict = "allowed" | "throttled" | "dropped";

export interface ViewerThrottle {
  /** Count one command from `viewerId` and say whether to relay it. */
  check(viewerId: string): ThrottleVerdict;
}

interface ViewerWindow {
  /** Accepted command times, oldest first; at most `limit` of them. */
  times: number[];
  /** A line was already dropped since the window last had room. */
  throttled: boolean;
}

export function createViewerThrottle({
  limit = VIEWER_COMMAND_LIMIT,
  windowMs = VIEWER_COMMAND_WINDOW_MS,
  maxViewers = MAX_TRACKED_VIEWERS,
  now = () => Date.now(),
}: {
  limit?: number;
  windowMs?: number;
  maxViewers?: number;
  now?: () => number;
} = {}): ViewerThrottle {
  // Insertion order = least recently active first (an entry is re-inserted on use).
  const viewers = new Map<string, ViewerWindow>();

  const prune = (entry: ViewerWindow, at: number) => {
    while (entry.times.length > 0 && at - (entry.times[0] as number) >= windowMs) {
      entry.times.shift();
    }
  };

  const evict = (at: number) => {
    for (const [id, entry] of viewers) {
      prune(entry, at);
      if (entry.times.length === 0) viewers.delete(id);
    }
    for (const id of viewers.keys()) {
      if (viewers.size < maxViewers) break;
      viewers.delete(id);
    }
  };

  return {
    check(viewerId) {
      const at = now();
      let entry = viewers.get(viewerId);
      if (entry) {
        viewers.delete(viewerId);
        prune(entry, at);
      } else {
        if (viewers.size >= maxViewers) evict(at);
        entry = { times: [], throttled: false };
      }
      viewers.set(viewerId, entry);

      if (entry.times.length < limit) {
        entry.times.push(at);
        entry.throttled = false;
        return "allowed";
      }
      if (entry.throttled) return "dropped";
      entry.throttled = true;
      return "throttled";
    },
  };
}
