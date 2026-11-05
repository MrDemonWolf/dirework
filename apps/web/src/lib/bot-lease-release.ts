// The bot page's chat-lease helpers that live outside React: the id this page load holds the
// lease under (pageLeaseId), and giving the lease up as the page closes (releaseBotLease).
//
// A closing bot page gives its chat lease up, so the next page to open (an OBS refresh, the
// dock opened after the widget) takes the chat at once instead of standing by for up to
// BOT_LEASE_TTL_MS. tRPC's client can't outlive the page, so this is a plain `keepalive`
// fetch of the same `bot.release` mutation (a non-batched tRPC POST: the body is the input).
// Not sendBeacon: it can't send `application/json`, which the api's /trpc guard requires.
// Best-effort: if it never lands, the lease simply expires.

import { apiOrigin } from "./api-origin";

// Set only in the browser, where a module variable lives exactly as long as the page does.
let leaseId: string | null = null;

/**
 * This page load's chat-lease id: one `crypto.randomUUID()` per page load, minted on first
 * use. Every bot session the page starts claims the lease under it (the dock's Reconnect, and
 * the (bot) error boundary's auto-restart, which remounts the console), so a restarted session
 * renews the lease its predecessor still holds instead of standing by for it, for up to
 * BOT_LEASE_TTL_MS. Browser-only: call it from an effect, never during render, so a server
 * render (one Worker isolate serves many requests) never mints or holds one.
 */
export function pageLeaseId(): string {
  if (leaseId === null) leaseId = crypto.randomUUID();
  return leaseId;
}

export function releaseBotLease(
  input: { token: string; instanceId: string },
  send: typeof fetch = fetch,
): void {
  try {
    void send(`${apiOrigin()}/trpc/bot.release`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).catch(() => undefined);
  } catch {
    // A browser that refuses a keepalive request at unload: the lease expires on its own.
  }
}
