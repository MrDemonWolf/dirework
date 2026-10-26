// The "Followers" task access level: whether a viewer follows the channel, cached per
// viewer in follower_check so a regular's !task asks Twitch at most once a week.
// Read only for a task-creating command (!task, !next) from a viewer the level doesn't
// already let in; written only after a Twitch lookup actually answered.

import { eq, lt } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import type { FollowLookup } from "./twitch-helix";

/** A confirmed follow is trusted this long before Twitch is asked again. */
export const FOLLOWER_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
/** A "not following" is trusted only briefly: a viewer who just followed gets in soon. */
export const NOT_FOLLOWER_CACHE_MS = 10 * 60 * 1000;

/** One viewer's cache row: a primary-key read. */
export function readFollowerCheckStmt(db: DbClient, twitchId: string) {
  return db
    .select()
    .from(schema.followerCheck)
    .where(eq(schema.followerCheck.twitchId, twitchId))
    .limit(1);
}

/** Every row past the longest TTL: an index range DELETE on checked_at. */
export function pruneFollowerChecksStmt(db: DbClient, now: number) {
  return db
    .delete(schema.followerCheck)
    .where(lt(schema.followerCheck.checkedAt, new Date(now - FOLLOWER_CACHE_MS)));
}

/** The cached answer for a viewer, or null when there is none or it is stale. */
export async function readCachedFollow(
  db: DbClient,
  twitchId: string,
  now: number,
): Promise<boolean | null> {
  const [row] = await readFollowerCheckStmt(db, twitchId);
  if (!row) return null;
  const age = now - row.checkedAt.getTime();
  const ttl = row.following ? FOLLOWER_CACHE_MS : NOT_FOLLOWER_CACHE_MS;
  return age >= 0 && age < ttl ? row.following : null;
}

/**
 * Store a lookup's answer, and in the same batch prune every row past the longest TTL
 * (an indexed range DELETE on checked_at), so the table holds at most a week of viewers.
 */
export async function recordFollow(
  db: DbClient,
  twitchId: string,
  following: boolean,
  now: number,
): Promise<void> {
  const checkedAt = new Date(now);
  await db.batch([
    db.insert(schema.followerCheck).values({ twitchId, following, checkedAt }).onConflictDoUpdate({
      target: schema.followerCheck.twitchId,
      set: { following, checkedAt },
    }),
    pruneFollowerChecksStmt(db, now),
  ]);
}

/**
 * Whether a viewer follows: the cached answer when fresh, else ONE `lookup` (Twitch),
 * whose clean answer is cached. `unavailable` is never cached, so the next command asks
 * again. A failed cache write doesn't change the answer.
 */
export async function checkFollower(
  db: DbClient,
  twitchId: string,
  lookup: () => Promise<FollowLookup>,
  now: number = Date.now(),
): Promise<FollowLookup> {
  const cached = await readCachedFollow(db, twitchId, now);
  if (cached !== null) return cached ? "following" : "not-following";
  const answer = await lookup();
  if (answer !== "unavailable") {
    try {
      await recordFollow(db, twitchId, answer === "following", now);
    } catch {
      // Best-effort: the viewer still gets this answer; the next command asks again.
    }
  }
  return answer;
}
