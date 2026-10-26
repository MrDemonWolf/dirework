// Ban cleanup: a permanently banned viewer's tasks leave the list. The bot page ignores
// timeouts and waits BAN_CLEANUP_DELAY_MS after a ban (a viewer who chats again in that
// time was unbanned, and the page drops the cleanup), then relays it here with `verify`.

import type { DbClient } from "@dirework/db";

import { removeTasksByUsername } from "./task-service";
import type { BanLookup } from "./twitch-helix";

export interface BanCleanupResult {
  /** Tasks removed (0 when the viewer had none, or the ban was lifted). */
  removed: number;
  /** What Twitch said; absent when nothing was asked (an unverified, older bot page). */
  check?: BanLookup;
}

/**
 * Remove `targetUsername`'s tasks unless Twitch says the ban was lifted. With `verify` and
 * the viewer's id, `lookupBan` asks Twitch first (one call, and only where Twitch allows it:
 * see `lookupBan`). Only a clean "not banned" keeps the tasks; `unsupported` and
 * `unavailable` remove them, as every ban did before the check existed.
 */
export async function cleanUpBannedViewer(
  db: DbClient,
  opts: {
    targetUsername: string;
    targetUserId?: string;
    verify: boolean;
    lookupBan: (userId: string) => Promise<BanLookup>;
  },
): Promise<BanCleanupResult> {
  let check: BanLookup | undefined;
  if (opts.verify && opts.targetUserId) {
    check = await opts.lookupBan(opts.targetUserId);
    if (check === "not-banned") return { removed: 0, check };
  }
  const removed = await removeTasksByUsername(db, opts.targetUsername);
  return check ? { removed, check } : { removed };
}
