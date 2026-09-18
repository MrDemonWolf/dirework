import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

// Single implementation of every task mutation (audit M1) — called by both
// the tRPC task router and the bot ingest path.

export interface TaskAuthor {
  twitchId: string;
  username: string;
  displayName: string;
  color?: string | null;
}

/**
 * Resolve the stable author key shared by dashboard and Twitch chat tasks.
 * Legacy owner rows can be missing the custom twitchId even though Better Auth
 * still has the provider account ID. The internal user ID is only a final
 * fallback for local dev owners that have no linked Twitch account.
 */
export async function resolveOwnerTaskId(
  db: DbClient,
  owner: { id: string; twitchId?: string | null },
) {
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

  return twitchAccount?.accountId || owner.id;
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

/** Broadcaster lookup + priority/order derivation (M6). */
export async function resolveTaskPlacement(db: DbClient, authorTwitchId: string) {
  const owner = await db.query.user.findFirst({
    columns: { id: true, twitchId: true },
    where: eq(schema.user.isOwner, true),
  });
  const ownerTaskId = owner ? await resolveOwnerTaskId(db, owner) : null;
  const isBroadcaster = ownerTaskId === authorTwitchId;
  const priority = isBroadcaster ? 0 : 1;

  const lastTask = await db.query.task.findFirst({
    where: eq(schema.task.priority, priority),
    orderBy: [desc(schema.task.order)],
    columns: { order: true },
  });

  return { isBroadcaster, priority, nextOrder: (lastTask?.order ?? 0) + 1 };
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
 */
export async function createTask(
  db: DbClient,
  author: TaskAuthor,
  text: string,
  opts?: { activate?: boolean },
) {
  const [openTasks, placement] = await Promise.all([
    getViewerOpenTasks(db, author.twitchId),
    resolveTaskPlacement(db, author.twitchId),
  ]);

  const values = {
    authorTwitchId: author.twitchId,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorColor: author.color ?? null,
    text,
    priority: placement.priority,
    order: placement.nextOrder,
  };
  const wantsActive = opts?.activate || openTasks.length === 0;

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
  // queues behind the one that won (P1.7).
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

/** SQLite/D1 surface UNIQUE constraint failures as a message, not a code. */
function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(message);
}

/** Mark a task done without promoting the next pending one. */
export async function completeTask(db: DbClient, id: string) {
  const [updated] = await db
    .update(schema.task)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(schema.task.id, id))
    .returning();
  return updated ?? null;
}

/**
 * Mark a task done; if it was active, promote the author's next pending task.
 * Complete + promote run in ONE db.batch (atomic on D1), so the viewer is never
 * momentarily left with zero active tasks and a concurrent command can't slot a
 * second task into the gap. Statement order matters: completing frees the
 * single-active slot before the promote claims it.
 */
export async function markTaskDone(db: DbClient, id: string) {
  const existing = await db.query.task.findFirst({
    where: eq(schema.task.id, id),
    columns: { id: true, status: true, authorTwitchId: true },
  });
  if (!existing) return null;

  if (existing.status !== "active") {
    return completeTask(db, existing.id);
  }

  const [completedRows] = await db.batch([
    db
      .update(schema.task)
      .set({ status: "done", completedAt: new Date() })
      // Guarded: if another request already completed it, we don't double-apply
      // and the paired promote is a no-op via its own not-exists guard.
      .where(and(eq(schema.task.id, existing.id), eq(schema.task.status, "active")))
      .returning(),
    promoteNextPendingStmt(db, existing.authorTwitchId),
  ]);

  return completedRows[0] ?? null;
}

/**
 * Complete the current active task and insert its replacement atomically.
 * If the insert fails, D1 rolls the completion back, so !next can never leave
 * a viewer with no active task merely because the second write failed.
 */
export async function replaceActiveTask(
  db: DbClient,
  activeTask: { id: string },
  author: TaskAuthor,
  text: string,
) {
  const placement = await resolveTaskPlacement(db, author.twitchId);
  const [completedRows, createdRows] = await db.batch([
    db
      .update(schema.task)
      .set({ status: "done", completedAt: new Date() })
      .where(
        and(
          eq(schema.task.id, activeTask.id),
          eq(schema.task.authorTwitchId, author.twitchId),
          eq(schema.task.status, "active"),
        ),
      )
      .returning(),
    db
      .insert(schema.task)
      .values({
        authorTwitchId: author.twitchId,
        authorUsername: author.username,
        authorDisplayName: author.displayName,
        authorColor: author.color ?? null,
        text,
        status: "active",
        priority: placement.priority,
        order: placement.nextOrder,
      })
      .returning(),
  ]);

  return { completed: completedRows[0] ?? null, created: createdRows[0] ?? null };
}

/** Update a task's text. */
export async function editTask(db: DbClient, id: string, text: string) {
  const [updated] = await db
    .update(schema.task)
    .set({ text })
    .where(eq(schema.task.id, id))
    .returning();
  return updated ?? null;
}

/**
 * Make `task` the author's single active task (demotes any other active).
 * Both statements run in ONE db.batch so the demote and the activate can't be
 * interleaved by a concurrent !focus — which previously could leave the viewer
 * with zero or two active tasks. Demote runs first to free the single-active
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

/** Delete every task by username, case-insensitive (L9 — ban/timeout/!clear @user). */
export async function removeTasksByUsername(db: DbClient, username: string) {
  return db.delete(schema.task).where(authorUsernameEquals(username));
}

export async function clearAllTasks(db: DbClient) {
  return db.delete(schema.task);
}

export async function clearDoneTasks(db: DbClient) {
  return db.delete(schema.task).where(eq(schema.task.status, "done"));
}

/**
 * All tasks in overlay/list order (priority, then insertion order). `id` is the
 * final tiebreaker so the order is deterministic when two tasks created
 * concurrently resolve to the same `order` value — without it the overlay and
 * the dashboard could disagree on which comes first (P1.7).
 */
export async function listTasks(db: DbClient) {
  return db.query.task.findMany({
    orderBy: [asc(schema.task.priority), asc(schema.task.order), asc(schema.task.id)],
  });
}
