import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

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

const OPEN_STATUSES = ["pending", "active"];

/** All open (pending or active) tasks for a viewer, in list order (M5). */
export async function getViewerOpenTasks(db: DbClient, twitchId: string) {
  return db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, twitchId),
      inArray(schema.task.status, OPEN_STATUSES),
    ),
    orderBy: [asc(schema.task.order)],
  });
}

/** The viewer's currently active task, if any. */
export async function getActiveTask(db: DbClient, twitchId: string) {
  const task = await db.query.task.findFirst({
    where: and(
      eq(schema.task.authorTwitchId, twitchId),
      eq(schema.task.status, "active"),
    ),
  });
  return task ?? null;
}

/** Case-insensitive lookup of another user's active task (for !check @user). */
export async function findActiveTaskByUsername(db: DbClient, username: string) {
  const task = await db.query.task.findFirst({
    where: and(
      sql`lower(${schema.task.authorUsername}) = lower(${username})`,
      eq(schema.task.status, "active"),
    ),
  });
  return task ?? null;
}

/** Broadcaster lookup + priority/order derivation (M6). */
export async function resolveTaskPlacement(db: DbClient, authorTwitchId: string) {
  const owner = await db.query.user.findFirst({ columns: { twitchId: true } });
  const isBroadcaster = owner?.twitchId != null && owner.twitchId === authorTwitchId;
  const priority = isBroadcaster ? 0 : 1;

  const lastTask = await db.query.task.findFirst({
    where: eq(schema.task.priority, priority),
    orderBy: [desc(schema.task.order)],
    columns: { order: true },
  });

  return { isBroadcaster, priority, nextOrder: (lastTask?.order ?? 0) + 1 };
}

/** Promote the viewer's first pending task to active (M5). */
export async function promoteNextPending(db: DbClient, twitchId: string) {
  const nextPending = await db.query.task.findFirst({
    where: and(
      eq(schema.task.authorTwitchId, twitchId),
      eq(schema.task.status, "pending"),
    ),
    orderBy: [asc(schema.task.order)],
  });
  if (!nextPending) return null;

  const [promoted] = await db.update(schema.task)
    .set({ status: "active" })
    .where(eq(schema.task.id, nextPending.id))
    .returning();
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

  const [row] = await db.insert(schema.task).values({
    authorTwitchId: author.twitchId,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorColor: author.color ?? null,
    text,
    status: opts?.activate || openTasks.length === 0 ? "active" : "pending",
    priority: placement.priority,
    order: placement.nextOrder,
  }).returning();
  return row ?? null;
}

/** Mark a task done WITHOUT promoting the next pending one (used by !next). */
export async function completeTask(db: DbClient, id: string) {
  const [updated] = await db.update(schema.task)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(schema.task.id, id))
    .returning();
  return updated ?? null;
}

/** Mark a task done; if it was active, promote the author's next pending task. */
export async function markTaskDone(db: DbClient, id: string) {
  const existing = await db.query.task.findFirst({
    where: eq(schema.task.id, id),
    columns: { id: true, status: true },
  });
  if (!existing) return null;

  const wasActive = existing.status === "active";
  const updated = await completeTask(db, existing.id);
  if (!updated) return null;

  if (wasActive) {
    await promoteNextPending(db, updated.authorTwitchId);
  }
  return updated;
}

/** Update a task's text. */
export async function editTask(db: DbClient, id: string, text: string) {
  const [updated] = await db.update(schema.task)
    .set({ text })
    .where(eq(schema.task.id, id))
    .returning();
  return updated ?? null;
}

/** Make `task` the author's single active task (demotes any other active). */
export async function activateTask(
  db: DbClient,
  task: { id: string; authorTwitchId: string },
) {
  await db.update(schema.task)
    .set({ status: "pending" })
    .where(and(
      eq(schema.task.authorTwitchId, task.authorTwitchId),
      eq(schema.task.status, "active"),
    ));

  const [activated] = await db.update(schema.task)
    .set({ status: "active" })
    .where(eq(schema.task.id, task.id))
    .returning();
  return activated ?? null;
}

/** Delete a task; if it was active, promote the author's next pending task. */
export async function removeTask(db: DbClient, id: string) {
  const [removed] = await db.delete(schema.task)
    .where(eq(schema.task.id, id))
    .returning();
  if (!removed) return null;

  if (removed.status === "active") {
    await promoteNextPending(db, removed.authorTwitchId);
  }
  return removed;
}

/** Delete every task by Twitch user id (dashboard moderation). */
export async function removeTasksByViewer(db: DbClient, twitchId: string) {
  return db.delete(schema.task).where(eq(schema.task.authorTwitchId, twitchId));
}

/** Delete every task by username, case-insensitive (L9 — ban/timeout/!clear @user). */
export async function removeTasksByUsername(db: DbClient, username: string) {
  return db.delete(schema.task)
    .where(sql`lower(${schema.task.authorUsername}) = lower(${username})`);
}

export async function clearAllTasks(db: DbClient) {
  return db.delete(schema.task);
}

export async function clearDoneTasks(db: DbClient) {
  return db.delete(schema.task).where(eq(schema.task.status, "done"));
}

export async function clearViewerTasks(db: DbClient) {
  return db.delete(schema.task).where(eq(schema.task.priority, 1));
}

/** All tasks in overlay/list order (priority, then insertion order). */
export async function listTasks(db: DbClient) {
  return db.query.task.findMany({
    orderBy: [asc(schema.task.priority), asc(schema.task.order)],
  });
}
