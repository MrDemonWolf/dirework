import { BOT_REAUTH_REQUIRED_MESSAGE } from "@dirework/api/config-shared";

/**
 * How the bot page should react to a failed bot API call:
 * - `revoked`: the bot-page token is wrong or was regenerated (UNAUTHORIZED).
 * - `invalid-link`: the request itself was rejected (BAD_REQUEST — e.g. a
 *   malformed bot-page token in the URL). Permanent: retrying the same link
 *   can never succeed. Only getSession treats it as fatal; a BAD_REQUEST on
 *   ingest just drops that one chat line.
 * - `reauth`: the token is fine but the bot's Twitch login can't be refreshed,
 *   so the streamer has to reconnect the bot account (PRECONDITION_FAILED with
 *   BOT_REAUTH_REQUIRED_MESSAGE; other PRECONDITION_FAILED causes are transient).
 * - `no-account`: no bot account is connected yet (NOT_FOUND); retry slowly.
 * - `transient`: anything else (network, 429, Twitch or D1 outage); retry.
 */
export type BotErrorKind = "revoked" | "invalid-link" | "reauth" | "no-account" | "transient";

/**
 * Reads the tRPC error code structurally (a TRPCClientError carries it on
 * `data.code`), so anything without a string code is transient.
 */
export function classifyBotError(err: unknown): BotErrorKind {
  if (typeof err !== "object" || err === null || !("data" in err)) return "transient";
  const code = (err as { data?: { code?: unknown } | null }).data?.code;
  if (typeof code !== "string") return "transient";
  if (code === "UNAUTHORIZED") return "revoked";
  if (code === "BAD_REQUEST") return "invalid-link";
  if (code === "PRECONDITION_FAILED") {
    const message = err instanceof Error ? err.message : undefined;
    return message === BOT_REAUTH_REQUIRED_MESSAGE ? "reauth" : "transient";
  }
  if (code === "NOT_FOUND") return "no-account";
  return "transient";
}
