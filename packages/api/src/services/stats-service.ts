import { and, eq, gte, lt, lte, sql } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import {
  localDay,
  retentionCutoff,
  statsWindowStart,
  summarizeStats,
  type StatsSummary,
} from "../stats-days";

// Dashboard stats (`daily_stat`, one row per local day). Every write here rides on a write
// the app already makes — a timer phase the guarded UPDATE moved past, a task the guarded
// UPDATE marked done — so a poll that changes nothing never records anything, and two
// pollers racing on the same phase can't count it twice (only the UPDATE's winner records).

/** Focus time a timer transition earned, landing on the day of `at`. */
export interface FocusCredit {
  /** When the time was earned: a phase's scheduled end, or the moment of a skip/reset. */
  at: number;
  focusMs: number;
  /** 1 only for a work phase that ran to its end. */
  pomodoros: number;
}

/**
 * The owner's stored IANA zone (null = UTC). One primary-key read of the singleton, run
 * beside a write path's own reads. A failure reads as UTC: stats never fail the write.
 */
export async function readStatsTimeZone(db: DbClient): Promise<string | null> {
  try {
    const row = await db.query.instanceConfig.findFirst({ columns: { timeZone: true } });
    return row?.timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Add focus credits as one upsert per local day (`ON CONFLICT(day) DO UPDATE SET x = x + …`),
 * all in one batch. Best-effort: the timer transition that earned them has already been
 * written, and a stats failure must never fail an overlay poll or a chat command.
 */
export async function recordFocusCredits(
  db: DbClient,
  credits: readonly FocusCredit[],
  timeZone: string | null,
): Promise<void> {
  const byDay = new Map<string, { focusMs: number; pomodoros: number }>();
  for (const credit of credits) {
    if (credit.focusMs <= 0 && credit.pomodoros <= 0) continue;
    const day = localDay(credit.at, timeZone);
    const total = byDay.get(day) ?? { focusMs: 0, pomodoros: 0 };
    total.focusMs += Math.round(Math.max(0, credit.focusMs));
    total.pomodoros += credit.pomodoros;
    byDay.set(day, total);
  }
  if (byDay.size === 0) return;
  try {
    const [first, ...rest] = [...byDay].map(([day, total]) =>
      db
        .insert(schema.dailyStat)
        .values({ day, ...total })
        .onConflictDoUpdate({
          target: schema.dailyStat.day,
          set: {
            focusMs: sql`${schema.dailyStat.focusMs} + excluded.focus_ms`,
            pomodoros: sql`${schema.dailyStat.pomodoros} + excluded.pomodoros`,
          },
        }),
    );
    if (first) await db.batch([first, ...rest]);
  } catch {
    // Best-effort (see above).
  }
}

/**
 * "This task's author is the owner", in SQL, matching every key `resolveOwnerTaskId` can
 * produce (the owner's twitch_id, their Twitch account id, or — for a local dev owner — the
 * user id), so the chat share costs no extra read.
 */
const authorIsOwnerSql = sql`exists (
  select 1 from ${schema.user}
  where ${schema.user.isOwner} = 1
    and (
      ${schema.user.twitchId} = ${schema.task.authorTwitchId}
      or ${schema.user.id} = ${schema.task.authorTwitchId}
      or exists (
        select 1 from ${schema.account}
        where ${schema.account.userId} = ${schema.user.id}
          and ${schema.account.providerId} = 'twitch'
          and ${schema.account.accountId} = ${schema.task.authorTwitchId}
      )
    )
)`;

/**
 * The statement that counts one finished task on `day`. It goes in the SAME db.batch as the
 * guarded UPDATE that marks the task done, IMMEDIATELY after it, and counts only when that
 * UPDATE won: `changes()` is the row count of the previous statement on the connection (a
 * batch runs its statements in order, in one transaction), and the task must be done with
 * exactly the `completedAt` that UPDATE stamped. So a second "done" of the same task (its
 * guard on the open status matches nothing) counts nothing, and `task.restore` — which
 * re-inserts a row, never through this path — can't count it again.
 * `tasks_done_chat` is 1 when the author is anyone but the owner.
 */
export function countTaskDoneStmt(
  db: DbClient,
  task: { id: string; completedAt: Date },
  day: string,
) {
  return db
    .insert(schema.dailyStat)
    .select(sql`
      select
        ${day},
        0,
        0,
        1,
        case when ${authorIsOwnerSql} then 0 else 1 end
      from ${schema.task}
      where ${schema.task.id} = ${task.id}
        and ${schema.task.status} = 'done'
        and ${schema.task.completedAt} = ${task.completedAt.getTime()}
        and changes() > 0
    `)
    .onConflictDoUpdate({
      target: schema.dailyStat.day,
      set: {
        tasksDone: sql`${schema.dailyStat.tasksDone} + excluded.tasks_done`,
        tasksDoneChat: sql`${schema.dailyStat.tasksDoneChat} + excluded.tasks_done_chat`,
      },
    });
}

/**
 * Delete stats rows past STATS_RETENTION_DAYS: a primary-key range DELETE, run when a timer
 * starts (a session boundary, like the done-task purge) and never on a poll. The cutoff is a
 * UTC day; a day either side of 400 doesn't matter. Best-effort, resolves to 0 on failure.
 */
export async function pruneDailyStats(db: DbClient, now: number = Date.now()): Promise<number> {
  try {
    const removed = await db
      .delete(schema.dailyStat)
      .where(lt(schema.dailyStat.day, retentionCutoff(now)))
      .returning({ day: schema.dailyStat.day });
    return removed.length;
  } catch {
    return 0;
  }
}

/**
 * The dashboard's stats: today, this week, the week streak and 14 daily buckets, from one
 * primary-key range read of at most 35 rows (this week plus the four before it).
 */
export async function getStatsSummary(
  db: DbClient,
  now: number = Date.now(),
): Promise<StatsSummary> {
  const timeZone = await readStatsTimeZone(db);
  const today = localDay(now, timeZone);
  const rows = await db
    .select()
    .from(schema.dailyStat)
    .where(
      and(gte(schema.dailyStat.day, statsWindowStart(today)), lte(schema.dailyStat.day, today)),
    );
  return summarizeStats(rows, today, timeZone ?? "UTC");
}

/**
 * Store the owner's zone, only when it differs (a guarded UPDATE, so the dashboard reporting
 * the zone it already has writes nothing). Resolves to whether a row changed.
 */
export async function setStatsTimeZone(db: DbClient, timeZone: string): Promise<boolean> {
  const updated = await db
    .update(schema.instanceConfig)
    .set({ timeZone })
    .where(
      and(
        eq(schema.instanceConfig.id, schema.SINGLETON_ID),
        sql`${schema.instanceConfig.timeZone} is not ${timeZone}`,
      ),
    )
    .returning({ timeZone: schema.instanceConfig.timeZone });
  return updated.length > 0;
}
