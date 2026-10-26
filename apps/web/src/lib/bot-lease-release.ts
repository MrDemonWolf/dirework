// A closing bot page gives its chat lease up, so the next page to open (an OBS refresh, the
// dock opened after the widget) takes the chat at once instead of standing by for up to
// BOT_LEASE_TTL_MS. tRPC's client can't outlive the page, so this is a plain `keepalive`
// fetch of the same `bot.release` mutation (a non-batched tRPC POST: the body is the input).
// Not sendBeacon: it can't send `application/json`, which the api's /trpc guard requires.
// Best-effort: if it never lands, the lease simply expires.

import { apiOrigin } from "./api-origin";

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
