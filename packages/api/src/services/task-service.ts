import { DrizzleQueryError, type SQL, and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { limitCombiningMarks } from "../chat-text";
import { localDay } from "../stats-days";
import { countTaskDoneStmt, type KnownTimeZone, resolveStatsTimeZone } from "./stats-service";

// Single implementation of every task mutation (audit M1) — called by both
// the tRPC task router and the bot ingest path.

export interface TaskAuthor {
  twitchId: string;
  username: string;
  displayName: string;
  color?: string | null;
}

/**
 * Resolve the owner's numeric Twitch user ID. Owner rows can be missing the
 * custom twitchId even though Better Auth still has the provider account ID
 * (the account's ID is the Twitch user ID). Null when no Twitch account is
 * linked (local dev owners).
 */
export async function resolveOwnerTwitchId(
  db: DbClient,
  owner: { id: string; twitchId?: string | null },
): Promise<string | null> {
  if (owner.twitchId) return owner.twitchId;

  const twitchAccount = await db.query.account.findFirst({
    where: and(
      eq(schema.account.userId, owner.id),
      eq(schema.account.providerId, "twitch"),
      ne(schema.account.accountId, ""),
    ),
    orderBy: [asc(schema.account.createdAt), asc(schema.account.id)],
    columns: { accountId: true },
  });

  return twitchAccount?.accountId || null;
}

/**
 * Resolve the stable author key shared by dashboard and Twitch chat tasks. The
 * internal user ID is only a final fallback for local dev owners that have no
 * linked Twitch account.
 */
export async function resolveOwnerTaskId(
  db: DbClient,
  owner: { id: string; twitchId?: string | null },
) {
  return (await resolveOwnerTwitchId(db, owner)) ?? owner.id;
}

const OPEN_STATUSES = ["pending", "active"];

/** Case-insensitive author-username predicate (Twitch logins are case-insensitive). */
const authorUsernameEquals = (username: string) =>
  sql`lower(${schema.task.authorUsername}) = lower(${username})`;

/** All open (pending or active) tasks for a viewer, in list order (M5). */
export async function getViewerOpenTasks(db: DbClient, twitchId: string) {
  return db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, twitchId),
      inArray(schema.task.status, OPEN_STATUSES),
    ),
    // id tiebreaks equal `order` values so positional commands (!done 2) are
    // stable — see listTasks.
    orderBy: [asc(schema.task.order), asc(schema.task.id)],
  });
}

/** The viewer's currently active task, if any. */
export async function getActiveTask(db: DbClient, twitchId: string) {
  const task = await db.query.task.findFirst({
    where: and(eq(schema.task.authorTwitchId, twitchId), eq(schema.task.status, "active")),
  });
  return task ?? null;
}

/** Case-insensitive lookup of another user's active task (for !check @user). */
export async function findActiveTaskByUsername(db: DbClient, username: string) {
  const task = await db.query.task.findFirst({
    where: and(authorUsernameEquals(username), eq(schema.task.status, "active")),
  });
  return task ?? null;
}

/**
 * Broadcaster lookup + priority/order derivation (M6). `knownIsBroadcaster`
 * lets a caller that already loaded the owner (bot ingest, which derives chat
 * privileges from it) skip reading the owner row a second time per chat line.
 */
export async function resolveTaskPlacement(
  db: DbClient,
  authorTwitchId: string,
  knownIsBroadcaster?: boolean,
) {
  const isBroadcaster = knownIsBroadcaster ?? (await isOwnerTaskAuthor(db, authorTwitchId));
  const priority = isBroadcaster ? 0 : 1;

  const lastTask = await db.query.task.findFirst({
    where: eq(schema.task.priority, priority),
    orderBy: [desc(schema.task.order)],
    columns: { order: true },
  });

  return { isBroadcaster, priority, nextOrder: (lastTask?.order ?? 0) + 1 };
}

async function isOwnerTaskAuthor(db: DbClient, authorTwitchId: string) {
  const owner = await db.query.user.findFirst({
    columns: { id: true, twitchId: true },
    where: eq(schema.user.isOwner, true),
  });
  const ownerTaskId = owner ? await resolveOwnerTaskId(db, owner) : null;
  return ownerTaskId === authorTwitchId;
}

/**
 * Options shared by the task-creating mutations. `isBroadcaster` is the
 * already-known "author is the streamer" answer (bot ingest passes the one it
 * derived chat privileges from); omitted, the owner row is read.
 */
interface TaskPlacementOpts {
  isBroadcaster?: boolean;
}

/**
 * SQL for "the viewer's next pending task", as a subquery. Ordering is
 * (order, id) so it stays deterministic when two tasks created concurrently
 * land on the same `order` value.
 */
function nextPendingIdSql(twitchId: string) {
  return sql`(select ${schema.task.id} from ${schema.task}
    where ${schema.task.authorTwitchId} = ${twitchId}
      and ${schema.task.status} = 'pending'
    order by ${schema.task.order} asc, ${schema.task.id} asc
    limit 1)`;
}

/**
 * Promote the viewer's first pending task to active (M5) as ONE statement —
 * the old find-then-update pair could promote two tasks when two commands
 * raced. Safe to include in a db.batch.
 */
export function promoteNextPendingStmt(db: DbClient, twitchId: string) {
  return db
    .update(schema.task)
    .set({ status: "active" })
    .where(
      and(
        eq(schema.task.id, nextPendingIdSql(twitchId)),
        // Belt-and-braces with the partial unique index: never promote while the
        // viewer already holds an active task.
        sql`not exists (select 1 from ${schema.task}
        where ${schema.task.authorTwitchId} = ${twitchId}
          and ${schema.task.status} = 'active')`,
      ),
    )
    .returning();
}

export async function promoteNextPending(db: DbClient, twitchId: string) {
  const [promoted] = await promoteNextPendingStmt(db, twitchId);
  return promoted ?? null;
}

/**
 * Create a task. Auto-activates when the author has no open tasks;
 * `activate: true` forces active (used by !next).
 *
 * `openTaskCount` lets a caller that already read the author's open tasks (the
 * chat cap check) pass the count instead of paying for the same query twice
 * per chat line. With `activate: true` the count is irrelevant and not read.
 * `isBroadcaster` skips the owner lookup (see TaskPlacementOpts).
 */
export async function createTask(
  db: DbClient,
  author: TaskAuthor,
  text: string,
  opts?: { activate?: boolean; openTaskCount?: number } & TaskPlacementOpts,
) {
  const knownCount = opts?.activate ? 0 : opts?.openTaskCount;
  const [openTaskCount, placement] = await Promise.all([
    knownCount ?? getViewerOpenTasks(db, author.twitchId).then((rows) => rows.length),
    resolveTaskPlacement(db, author.twitchId, opts?.isBroadcaster),
    purgeExpiredDoneTasks(db),
  ]);

  const values = {
    authorTwitchId: author.twitchId,
    authorUsername: author.username,
    authorDisplayName: limitCombiningMarks(author.displayName),
    authorColor: author.color ?? null,
    text: limitCombiningMarks(text),
    priority: placement.priority,
    order: placement.nextOrder,
  };
  const wantsActive = opts?.activate || openTaskCount === 0;

  if (!wantsActive) {
    const [row] = await db
      .insert(schema.task)
      .values({ ...values, status: "pending" })
      .returning();
    return row ?? null;
  }

  // The read above is a check-then-act: a concurrent !task from the same viewer
  // can also observe "no open tasks" and try to insert an active row. The
  // partial unique index makes the loser fail instead of creating a second
  // active task, so fall back to pending — the task is still created, it just
  // queues behind the one that won.
  try {
    const [row] = await db
      .insert(schema.task)
      .values({ ...values, status: "active" })
      .returning();
    return row ?? null;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [row] = await db
      .insert(schema.task)
      .values({ ...values, status: "pending" })
      .returning();
    return row ?? null;
  }
}

/**
 * SQLite/D1 surface UNIQUE constraint failures as a message, not a code, and
 * drizzle wraps the driver error in a DrizzleQueryError whose own message
 * embeds the query params (task text) — so only the wrapped causes are matched.
 * Bounded so a cyclic cause chain can't loop.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current != null && depth < 5; depth++) {
    if (!(current instanceof Error)) return false;
    if (
      !(current instanceof DrizzleQueryError) &&
      /UNIQUE constraint failed/i.test(current.message)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * Mark a pending task done (no promote needed: a pending task never held the
 * author's active slot). Guarded on `status = 'pending'`, so it neither
 * re-stamps an already-done task (which would reset its 24h retention) nor
 * completes a task that was promoted to active since the caller read it —
 * that one needs the promote batch in `markTaskDone`. Null when nothing matched.
 */
export async function completeTask(db: DbClient, id: string, timeZone?: KnownTimeZone) {
  const zone = await resolveStatsTimeZone(db, timeZone);
  const completedAt = new Date();
  const complete = () =>
    db
      .update(schema.task)
      .set({ status: "done", completedAt })
      .where(and(eq(schema.task.id, id), eq(schema.task.status, "pending")))
      .returning();
  const updatedRows = await withStatsFallback(
    async () =>
      (
        await db.batch([
          complete(),
          countTaskDoneStmt(db, { id, completedAt }, localDay(completedAt.getTime(), zone)),
        ])
      )[0],
    () => complete(),
  );
  return updatedRows[0] ?? null;
}

/**
 * Dashboard stats never fail a task mutation: run `withStats` (the mutation's batch with its
 * stats statement), and if that throws, `withoutStats` (the same guarded mutation alone). A D1
 * batch is atomic, so a batch that threw applied nothing, and every retried statement keeps
 * its status guard, so the mutation can never apply twice. The stats for it are skipped.
 */
async function withStatsFallback<T>(
  withStats: () => Promise<T>,
  withoutStats: () => Promise<T>,
): Promise<T> {
  try {
    return await withStats();
  } catch {
    return withoutStats();
  }
}

/**
 * Mark a task done; if it was active, promote the author's next pending task.
 * Complete + promote run in ONE db.batch (atomic on D1), so the viewer is never
 * momentarily left with zero active tasks and a concurrent command can't slot a
 * second task into the gap. Statement order matters: completing frees the
 * single-active slot before the promote claims it.
 *
 * Both writes are guarded on the status that was read. If a concurrent request
 * changed it in between (typically: removing the active task promoted this
 * pending one), the status is re-read once and the matching path retried.
 * An already-done task is a no-op (null), not a rewrite. `timeZone` (the owner's,
 * when the caller already read it) saves the stats zone read on the chat path.
 */
export async function markTaskDone(
  db: DbClient,
  id: string,
  opts: { timeZone?: KnownTimeZone } = {},
) {
  const [first, , timeZone] = await Promise.all([
    readTaskStatus(db, id),
    purgeExpiredDoneTasks(db),
    resolveStatsTimeZone(db, opts.timeZone),
  ]);
  let existing = first;

  for (let attempt = 0; existing && existing.status !== "done" && attempt < 2; attempt++) {
    const done =
      existing.status === "active"
        ? await completeActiveTask(db, existing, timeZone)
        : await completeTask(db, existing.id, timeZone);
    if (done) return done;
    existing = await readTaskStatus(db, id);
  }
  return null;
}

function readTaskStatus(db: DbClient, id: string) {
  return db.query.task.findFirst({
    where: eq(schema.task.id, id),
    columns: { id: true, status: true, authorTwitchId: true },
  });
}

async function completeActiveTask(
  db: DbClient,
  task: { id: string; authorTwitchId: string },
  timeZone: string | null,
) {
  const completedAt = new Date();
  const complete = () =>
    db
      .update(schema.task)
      .set({ status: "done", completedAt })
      // Guarded: if another request already completed it, we don't double-apply
      // and the paired promote is a no-op via its own not-exists guard.
      .where(and(eq(schema.task.id, task.id), eq(schema.task.status, "active")))
      .returning();
  const completedRows = await withStatsFallback(
    async () =>
      (
        await db.batch([
          complete(),
          // Counts only if the UPDATE above won (see countTaskDoneStmt).
          countTaskDoneStmt(
            db,
            { id: task.id, completedAt },
            localDay(completedAt.getTime(), timeZone),
          ),
          promoteNextPendingStmt(db, task.authorTwitchId),
        ])
      )[0],
    async () => (await db.batch([complete(), promoteNextPendingStmt(db, task.authorTwitchId)]))[0],
  );
  return completedRows[0] ?? null;
}

/**
 * Replace the current active task atomically. The pending insert is guarded by
 * the old task still being active, so a stale !next cannot create a new task.
 * `timeZone` (the owner's, when the caller already read it) saves the stats
 * zone read on the chat path.
 */
export async function replaceActiveTask(
  db: DbClient,
  activeTask: { id: string },
  author: TaskAuthor,
  text: string,
  opts?: TaskPlacementOpts & { timeZone?: KnownTimeZone },
) {
  const [placement, , timeZone] = await Promise.all([
    resolveTaskPlacement(db, author.twitchId, opts?.isBroadcaster),
    purgeExpiredDoneTasks(db),
    resolveStatsTimeZone(db, opts?.timeZone),
  ]);
  const replacementId = crypto.randomUUID();
  const completedAt = new Date();
  const insertReplacement = () =>
    db.insert(schema.task).select(sql`
      select
        ${replacementId},
        ${author.twitchId},
        ${author.username},
        ${limitCombiningMarks(author.displayName)},
        ${author.color ?? null},
        ${limitCombiningMarks(text)},
        'pending',
        ${placement.priority},
        ${placement.nextOrder},
        cast(unixepoch('subsecond') * 1000 as integer),
        null
      from ${schema.task}
      where ${schema.task.id} = ${activeTask.id}
        and ${schema.task.authorTwitchId} = ${author.twitchId}
        and ${schema.task.status} = 'active'
    `);
  const completeOld = () =>
    db
      .update(schema.task)
      .set({ status: "done", completedAt })
      .where(
        and(
          eq(schema.task.id, activeTask.id),
          eq(schema.task.authorTwitchId, author.twitchId),
          eq(schema.task.status, "active"),
        ),
      )
      .returning();
  const activateReplacement = () =>
    db
      .update(schema.task)
      .set({ status: "active" })
      .where(and(eq(schema.task.id, replacementId), eq(schema.task.status, "pending")))
      .returning();

  const [completedRows, createdRows] = await withStatsFallback(
    async () => {
      const [, completed, , created] = await db.batch([
        insertReplacement(),
        completeOld(),
        countTaskDoneStmt(
          db,
          { id: activeTask.id, completedAt },
          localDay(completedAt.getTime(), timeZone),
        ),
        activateReplacement(),
      ]);
      return [completed, created] as const;
    },
    async () => {
      const [, completed, created] = await db.batch([
        insertReplacement(),
        completeOld(),
        activateReplacement(),
      ]);
      return [completed, created] as const;
    },
  );

  return { completed: completedRows[0] ?? null, created: createdRows[0] ?? null };
}

/** Update a task's text. */
export async function editTask(db: DbClient, id: string, text: string) {
  const [updated] = await db
    .update(schema.task)
    .set({ text: limitCombiningMarks(text) })
    .where(eq(schema.task.id, id))
    .returning();
  return updated ?? null;
}

/**
 * Make `task` the author's single active task (demotes any other active).
 * Both statements run in ONE db.batch so the demote and the activate can't be
 * interleaved by a concurrent !focus, which could leave the viewer with zero or
 * two active tasks. Demote runs first to free the single-active
 * slot enforced by the partial unique index.
 */
export async function activateTask(db: DbClient, task: { id: string; authorTwitchId: string }) {
  // Evaluate target existence inside the same atomic batch. If a concurrent
  // command already completed/deleted this stale target, the demotion is a
  // no-op too — never leave the viewer with no active task.
  const targetIsStillOpen = sql`exists (
    select 1 from ${schema.task}
    where ${schema.task.id} = ${task.id}
      and ${schema.task.authorTwitchId} = ${task.authorTwitchId}
      and ${schema.task.status} in ('pending', 'active')
  )`;

  const [, activatedRows] = await db.batch([
    db
      .update(schema.task)
      .set({ status: "pending" })
      .where(
        and(
          eq(schema.task.authorTwitchId, task.authorTwitchId),
          eq(schema.task.status, "active"),
          targetIsStillOpen,
        ),
      ),
    db
      .update(schema.task)
      .set({ status: "active" })
      .where(
        and(
          eq(schema.task.id, task.id),
          eq(schema.task.authorTwitchId, task.authorTwitchId),
          inArray(schema.task.status, OPEN_STATUSES),
        ),
      )
      .returning(),
  ]);
  return activatedRows[0] ?? null;
}

/**
 * Delete a task; if it was active, promote the author's next pending task.
 * The delete must resolve first to learn the author, so this is a read-then-
 * batch rather than one batch; the promote carries its own not-exists guard, so
 * a concurrent promote can't produce a second active task.
 */
export async function removeTask(db: DbClient, id: string) {
  const [removed] = await db.delete(schema.task).where(eq(schema.task.id, id)).returning();
  if (!removed) return null;

  if (removed.status === "active") {
    await promoteNextPending(db, removed.authorTwitchId);
  }
  return removed;
}

/** A removed task row, as handed back to the dashboard for undo. */
export interface TaskSnapshot {
  id: string;
  authorTwitchId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorColor: string | null;
  text: string;
  status: "pending" | "active" | "done";
  priority: number;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Re-insert a task the owner just removed (dashboard undo), keeping its id,
 * author, placement, status and timestamps.
 *
 * One INSERT … SELECT, so the single-active check and the insert are a single
 * atomic statement: when removing the active task promoted the author's next
 * pending one, the restored task comes back as `pending` instead of fighting
 * the promoted task for `task_one_active_per_author_idx`. Its original `order`
 * still sorts it first in the author's queue.
 *
 * Owner-only action, so it deliberately has no viewer caps (chat has none
 * either — task text is bounded by the input schema). An id that already exists
 * (a double-clicked undo) is a no-op that returns null.
 */
export async function restoreTask(db: DbClient, snapshot: TaskSnapshot) {
  const status =
    snapshot.status === "active"
      ? sql`case when exists (
          select 1 from ${schema.task}
          where ${schema.task.authorTwitchId} = ${snapshot.authorTwitchId}
            and ${schema.task.status} = 'active'
        ) then 'pending' else 'active' end`
      : sql`${snapshot.status}`;
  // Only done rows carry a completion time; the 24h purge keys off it.
  const completedAt =
    snapshot.status === "done" ? (snapshot.completedAt ?? new Date()).getTime() : null;

  const [row] = await db
    .insert(schema.task)
    // `where true` keeps SQLite from parsing ON CONFLICT as part of the SELECT.
    .select(sql`
      select
        ${snapshot.id},
        ${snapshot.authorTwitchId},
        ${snapshot.authorUsername},
        ${snapshot.authorDisplayName},
        ${snapshot.authorColor},
        ${snapshot.text},
        ${status},
        ${snapshot.priority},
        ${snapshot.order},
        ${snapshot.createdAt.getTime()},
        ${completedAt}
      where true
    `)
    // Targeted at the primary key only: a single-active violation must still throw.
    .onConflictDoNothing({ target: schema.task.id })
    .returning();
  return row ?? null;
}

/**
 * The unexecuted DELETE behind removeTasksByUsername — safe to include in a
 * db.batch (the viewer block list removes tasks atomically with the list edit).
 * `onlyIf` adds a guard evaluated in the same statement.
 */
export function removeTasksByUsernameStmt(db: DbClient, username: string, onlyIf?: SQL) {
  return db
    .delete(schema.task)
    .where(onlyIf ? and(authorUsernameEquals(username), onlyIf) : authorUsernameEquals(username));
}

/**
 * Delete every task by username, case-insensitive (L9 — ban/timeout/!clear @user).
 * Resolves to how many tasks were removed (same single DELETE, with RETURNING),
 * so `!clear @user` can say when there was nothing to clear.
 */
export async function removeTasksByUsername(db: DbClient, username: string): Promise<number> {
  const removed = await removeTasksByUsernameStmt(db, username).returning({ id: schema.task.id });
  return removed.length;
}

export async function clearAllTasks(db: DbClient) {
  return db.delete(schema.task);
}

export async function clearDoneTasks(db: DbClient) {
  return db.delete(schema.task).where(eq(schema.task.status, "done"));
}

/** Done tasks are kept for this long after `completed_at`, then purged. */
export const DONE_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;

/** At most this many (newest) done tasks are returned to the list/overlay. */
export const DONE_TASK_LIST_LIMIT = 50;

/**
 * Delete done tasks whose `completed_at` is older than the retention window.
 * An index range DELETE on `task_status_completed_idx`, so it reads only the
 * rows it removes (plus one seek) — cheap enough to run lazily on writes
 * (task create / done / replace, timer start / reset). Never run it on a poll.
 *
 * Best-effort housekeeping: a failure here must never fail the chat command or
 * dashboard action that triggered it, so it resolves to 0 instead of throwing.
 */
export async function purgeExpiredDoneTasks(db: DbClient, now: number = Date.now()) {
  try {
    const result = await db
      .delete(schema.task)
      .where(
        and(
          eq(schema.task.status, "done"),
          lt(schema.task.completedAt, new Date(now - DONE_TASK_RETENTION_MS)),
        ),
      )
      .returning({ id: schema.task.id });
    return result.length;
  } catch {
    return 0;
  }
}

export interface TaskCounts {
  /** Pending + active tasks (every one is returned in the list). */
  open: number;
  /**
   * Every done task still in retention — NOT just the bounded slice the list
   * returns, so `{done}/{total}` counters stay right past the list limit.
   */
  done: number;
  /**
   * The same done count per `authorTwitchId`, so a per-author `{done}/{total}`
   * header stays right even when that author's older done tasks fall outside
   * the bounded slice (or the overlay skips done rows entirely).
   */
  doneByAuthor: Record<string, number>;
}

const listOrder = (a: { priority: number; order: number; id: string }, b: typeof a) =>
  a.priority - b.priority || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The bounded list read behind the dashboard and the task overlay. Open tasks
 * come from an index range on status; done tasks are the newest `doneLimit`
 * by completed_at (index range + LIMIT); the done counters are a per-author
 * COUNT over the same index range. Nothing scans the table, and retention bounds the done range.
 * The two slices are merged back into list order (priority, order, id).
 */
async function readBoundedTasks<TRow extends { id: string; priority: number; order: number }>(
  db: DbClient,
  readOpen: () => Promise<TRow[]>,
  readDone: (limit: number) => Promise<TRow[]>,
  doneLimit: number,
) {
  const [open, done, doneGroups] = await Promise.all([
    readOpen(),
    doneLimit > 0 ? readDone(doneLimit) : Promise.resolve([] as TRow[]),
    db
      .select({ author: schema.task.authorTwitchId, n: sql<number>`count(*)` })
      .from(schema.task)
      .where(doneTasksWhere())
      .groupBy(schema.task.authorTwitchId),
  ]);
  const doneByAuthor: Record<string, number> = {};
  let doneCount = 0;
  for (const { author, n } of doneGroups) {
    doneByAuthor[author] = Number(n);
    doneCount += Number(n);
  }
  const counts: TaskCounts = { open: open.length, done: doneCount, doneByAuthor };
  return { tasks: [...open, ...done].sort(listOrder), counts };
}

const openTasksWhere = () => inArray(schema.task.status, OPEN_STATUSES);
const doneTasksWhere = () => eq(schema.task.status, "done");
const doneNewestFirst = () => [desc(schema.task.completedAt), desc(schema.task.id)];

/**
 * The dashboard list: every open task plus the newest DONE_TASK_LIST_LIMIT
 * done tasks, in overlay/list order (priority, then insertion order). `id` is
 * the final tiebreaker so the order is deterministic when two tasks created
 * concurrently resolve to the same `order` value — without it the overlay and
 * the dashboard could disagree on which comes first.
 */
export async function listTasks(db: DbClient, opts?: { doneLimit?: number }) {
  return readBoundedTasks(
    db,
    () => db.query.task.findMany({ where: openTasksWhere() }),
    (limit) =>
      db.query.task.findMany({ where: doneTasksWhere(), orderBy: doneNewestFirst(), limit }),
    opts?.doneLimit ?? DONE_TASK_LIST_LIMIT,
  );
}

const OVERLAY_TASK_COLUMNS = {
  id: true,
  authorTwitchId: true,
  authorDisplayName: true,
  authorColor: true,
  text: true,
  status: true,
  // Read for the list-order merge only; stripped before leaving the server.
  priority: true,
  order: true,
} as const;

/**
 * The public task overlay's list: same rows and order as listTasks, but only
 * the columns the overlay renders — no viewer login names or timestamps leave
 * the server through the bearer-token URL. Pass `doneLimit: 0` when the overlay
 * hides done tasks: the counter still gets the full done count.
 */
export async function listOverlayTasks(db: DbClient, opts?: { doneLimit?: number }) {
  const { tasks, counts } = await readBoundedTasks(
    db,
    () => db.query.task.findMany({ columns: OVERLAY_TASK_COLUMNS, where: openTasksWhere() }),
    (limit) =>
      db.query.task.findMany({
        columns: OVERLAY_TASK_COLUMNS,
        where: doneTasksWhere(),
        orderBy: doneNewestFirst(),
        limit,
      }),
    opts?.doneLimit ?? DONE_TASK_LIST_LIMIT,
  );
  return {
    tasks: tasks.map(({ priority: _priority, order: _order, ...task }) => task),
    counts,
  };
}
