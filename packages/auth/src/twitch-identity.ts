import { and, eq, isNull, or } from "drizzle-orm";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

/**
 * Copy the Twitch user ID from a newly linked provider account onto the user
 * row. better-auth drops `input: false` additional fields returned by
 * `mapProfileToUser`, so `user.twitchId` is never set at sign-up; the account's
 * `accountId` is the same numeric Twitch ID (what IRC's user-id tag carries).
 * Only fills an empty column — it never overwrites an existing ID.
 */
export async function persistTwitchIdFromAccount(
  db: DbClient,
  account: { providerId: string; accountId: string; userId: string },
): Promise<void> {
  if (account.providerId !== "twitch" || !account.accountId) return;

  await db
    .update(schema.user)
    .set({ twitchId: account.accountId })
    .where(
      and(
        eq(schema.user.id, account.userId),
        or(isNull(schema.user.twitchId), eq(schema.user.twitchId, "")),
      ),
    );
}
