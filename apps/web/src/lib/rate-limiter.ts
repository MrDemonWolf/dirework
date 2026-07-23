/**
 * Pure, clock-injected rate limiter for outbound Twitch chat. Enforces two
 * Twitch limits at once, conservatively (we assume a regular, non-verified,
 * non-mod bot account unless privileges are known):
 *
 *   - a rolling window cap:  maxInWindow messages per windowMs
 *   - a per-message min gap: minGapMs between consecutive messages (1/sec/channel)
 *
 * Twitch's documented limits for a regular account are 20 messages / 30s and no
 * more than ~1 message/second to a channel. Exceeding either risks an 8-hour
 * global chat ban on the bot account, so we stay strictly under both.
 *
 * No timers, no Date.now — the caller passes `now`, so tests are deterministic.
 */
export interface RateLimitOptions {
  windowMs: number;
  maxInWindow: number;
  minGapMs: number;
}

export class RateLimiter {
  private readonly opts: RateLimitOptions;
  /** Send timestamps within the current window, ascending. */
  private timestamps: number[] = [];

  constructor(opts: RateLimitOptions) {
    this.opts = opts;
  }

  /**
   * Earliest time (≥ now) at which a message may be sent given recorded
   * history. When it equals `now`, a send is allowed immediately.
   */
  nextAllowed(now: number): number {
    this.prune(now);
    let at = now;

    const last = this.timestamps[this.timestamps.length - 1];
    if (last !== undefined) at = Math.max(at, last + this.opts.minGapMs);

    if (this.timestamps.length >= this.opts.maxInWindow) {
      // The message `maxInWindow` back must fall out of the window first.
      const binding = this.timestamps[this.timestamps.length - this.opts.maxInWindow];
      if (binding !== undefined) at = Math.max(at, binding + this.opts.windowMs);
    }
    return at;
  }

  /** Register a send at time `t`. */
  record(t: number): void {
    this.timestamps.push(t);
    this.prune(t);
  }

  private prune(now: number): void {
    const cutoff = now - this.opts.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! <= cutoff) {
      this.timestamps.shift();
    }
  }
}
