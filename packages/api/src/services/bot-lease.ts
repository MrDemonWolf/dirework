import { and, eq, isNull, lte, or } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { SINGLETON_ID } from "@dirework/db/schema";

import { BOT_LEASE_TTL_MS } from "../bot-lease";

// The bot page lease on the instance_config singleton (see ../bot-lease.ts): which open bot
// page may hold the Twitch chat connection. Every write is ONE guarded UPDATE by primary key,
// so two pages claiming at once can never both win: SQLite runs them one after the other and
// the second sees the first's id.

const leaseId = schema.instanceConfig.botLeaseInstanceId;
const leaseSeenAt = schema.instanceConfig.botLeaseSeenAt;

/**
 * Take or renew the lease for `instanceId`: it lands only when the lease is free, expired
 * (no check-in for BOT_LEASE_TTL_MS) or already this page's, or unconditionally with
 * `takeover` (the dock's "Take over"; the old holder sees it on its next heartbeat or ingest).
 * The holder always renews, so a running page writes once per heartbeat. Resolves whether
 * this page holds the lease now.
 */
export async function claimBotLease(db: DbClient, opts: ClaimBotLeaseOptions): Promise<boolean> {
  const rows = await claimBotLeaseStmt(db, opts);
  return rows.length > 0;
}

export interface ClaimBotLeaseOptions {
  instanceId: string;
  takeover?: boolean;
  now?: number;
}

/** The claim's UPDATE, exported so a test can EXPLAIN the exact SQL it runs. */
export function claimBotLeaseStmt(
  db: DbClient,
  { instanceId, takeover = false, now = Date.now() }: ClaimBotLeaseOptions,
) {
  const singleton = eq(schema.instanceConfig.id, SINGLETON_ID);
  return db
    .update(schema.instanceConfig)
    .set({ botLeaseInstanceId: instanceId, botLeaseSeenAt: new Date(now) })
    .where(
      takeover
        ? singleton
        : and(
            singleton,
            or(
              isNull(leaseId),
              eq(leaseId, instanceId),
              isNull(leaseSeenAt),
              lte(leaseSeenAt, new Date(now - BOT_LEASE_TTL_MS)),
            ),
          ),
    )
    .returning({ id: schema.instanceConfig.id });
}

/**
 * Give the lease up (a bot page closing), so the next page to open takes it at once instead
 * of waiting out the TTL and the dashboard reads "Bot offline". Only the holder's own id
 * clears it: a closing page that already lost the lease leaves the new holder alone.
 */
export async function releaseBotLease(db: DbClient, instanceId: string): Promise<boolean> {
  const rows = await db
    .update(schema.instanceConfig)
    .set({ botLeaseInstanceId: null, botLeaseSeenAt: null })
    .where(and(eq(schema.instanceConfig.id, SINGLETON_ID), eq(leaseId, instanceId)))
    .returning({ id: schema.instanceConfig.id });
  return rows.length > 0;
}
