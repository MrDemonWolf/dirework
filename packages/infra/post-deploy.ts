/**
 * Post-cutover D1 housekeeping, run by alchemy.run.ts after both workers are
 * live. Migrations apply BEFORE the new workers take traffic, so a one-shot
 * data migration can be undone by the previous build in that window — e.g. an
 * owner sign-in served by the old api worker writing Twitch tokens back after
 * migration 0014 scrubbed them. Re-asserting the invariant here, once the old
 * build is gone, closes that window without waiting for the next sign-in.
 *
 * Idempotent and cheap (a guarded UPDATE over the tiny `account` table), so it
 * runs on every deploy. Pure apart from the injected API client, so it is
 * unit-tested.
 */

/**
 * Mirrors `scrubOwnerTokens` in packages/auth (which also runs at every
 * sign-in). Bot credentials live in `bot_account` and are untouched.
 */
export const OWNER_TOKEN_SCRUB_SQL =
  "UPDATE `account` SET `access_token` = NULL, `refresh_token` = NULL, `id_token` = NULL " +
  "WHERE `provider_id` = 'twitch' AND (`access_token` IS NOT NULL OR `refresh_token` IS NOT NULL OR `id_token` IS NOT NULL);";

export interface D1QueryApi {
  accountId: string;
  post: (path: string, body: unknown) => Promise<Response>;
}

export async function scrubOwnerTokensAfterCutover(
  api: D1QueryApi,
  databaseId: string,
): Promise<void> {
  const res = await api.post(`/accounts/${api.accountId}/d1/database/${databaseId}/query`, {
    sql: OWNER_TOKEN_SCRUB_SQL,
  });
  // Never echo the response body: a D1 error repeats the statement.
  if (!res.ok) {
    throw new Error(`Post-deploy owner token scrub failed (HTTP ${res.status}).`);
  }
}
