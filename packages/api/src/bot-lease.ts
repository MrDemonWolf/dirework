// The bot page lease, the pure half (zod- and schema-free, so the bot page and the dashboard
// import it without bundling either). Only one open bot page (widget or dock) holds the
// Twitch chat connection at a time: the holder checks in with `bot.heartbeat` every
// BOT_HEARTBEAT_MS, and a lease nobody renewed for BOT_LEASE_TTL_MS is free again. The SQL
// half is services/bot-lease.ts.

/**
 * How long a lease outlives its last check-in. 2.5 heartbeats, so one lost or late
 * heartbeat never drops a running bot, and a closed page frees the chat within 5 minutes.
 * Also the dashboard's "Bot connected" window.
 */
export const BOT_LEASE_TTL_MS = 5 * 60_000;

/**
 * `bot.ingest`'s refusal when another bot page holds the lease (CONFLICT): the stale page
 * stops relaying and drops to standby. A fixed message, matched like the reauth one.
 */
export const BOT_STANDBY_MESSAGE = "Another bot page is running this bot";

/** Whether a lease last renewed at `seenAt` still holds at `now` (an unrenewed one is free). */
export function isBotLeaseLive(seenAt: Date | null, now: number): boolean {
  return seenAt !== null && now - seenAt.getTime() < BOT_LEASE_TTL_MS;
}

/**
 * Whether ANOTHER bot page holds a live lease, so `instanceId` must not relay chat. A free
 * or expired lease blocks nobody: the holder may just have missed its heartbeats, and its
 * next one (or this page's) takes the lease back.
 */
export function isLeaseHeldByOther(
  lease: { instanceId: string | null; seenAt: Date | null },
  instanceId: string,
  now: number,
): boolean {
  return (
    lease.instanceId !== null &&
    lease.instanceId !== instanceId &&
    isBotLeaseLive(lease.seenAt, now)
  );
}
