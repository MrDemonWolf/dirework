export interface Task {
  id: string;
  authorTwitchId?: string;
  authorDisplayName: string;
  authorColor: string | null;
  text: string;
  status: string;
}

export interface TaskGroup {
  authorKey: string;
  authorDisplayName: string;
  authorColor: string | null;
  pending: number;
  done: number;
  tasks: Task[];
}

/**
 * The key a task's author is grouped by: the Twitch id, or the display name for a row without
 * one. The board's groups, its done counts and the timer's "Now" all use it, so they agree.
 */
export function authorKey(task: Pick<Task, "authorTwitchId" | "authorDisplayName">): string {
  return task.authorTwitchId || task.authorDisplayName;
}

/** The owner's author key from `user.me` (their Twitch id, else the user id); "" until it loads. */
export function ownerAuthorKey(
  me: { twitchId?: string | null; id: string } | null | undefined,
): string {
  return me?.twitchId ?? me?.id ?? "";
}

/** Done tasks per author key, counted from rows (for full, unbounded lists). */
export function countDoneByAuthor(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.status !== "done") continue;
    const key = authorKey(task);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Group tasks by author, in first-appearance order. Pass the server's
 * `counts.doneByAuthor` whenever the list is the bounded slice (dashboard,
 * overlay): older done tasks are missing from `tasks`, so counting rows would
 * understate each author's done total. Without it, done rows are counted.
 */
export function groupTasksByAuthor(
  tasks: Task[],
  doneByAuthor?: Record<string, number>,
): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = authorKey(task);
    let group = groups.get(key);
    if (!group) {
      group = {
        authorKey: key,
        authorDisplayName: task.authorDisplayName,
        authorColor: task.authorColor,
        pending: 0,
        done: 0,
        tasks: [],
      };
      groups.set(key, group);
    }
    if (task.status === "done") group.done++;
    else group.pending++;
    group.tasks.push(task);
  }
  const result = Array.from(groups.values());
  if (doneByAuthor) {
    for (const group of result) group.done = doneByAuthor[group.authorKey] ?? 0;
  }
  return result;
}

/**
 * Whether the board's checkbox may mark a task done: every open status — the focus
 * (`active`), a parked `started` task and a `pending` one (`markTaskDone` accepts all
 * three). Done rows and unknown statuses are no-ops.
 */
export function canMarkTaskDone(status: string): boolean {
  return status === "active" || status === "started" || status === "pending";
}

/**
 * The owner's own active task, or null: what the timer console shows as "Now". `ownerKey` is
 * the same author key the board groups by (the owner's Twitch id); chat's active tasks never
 * count, and an empty key matches nothing.
 */
export function ownerActiveTask<T extends Task>(tasks: readonly T[], ownerKey: string): T | null {
  if (!ownerKey) return null;
  return tasks.find((task) => task.status === "active" && authorKey(task) === ownerKey) ?? null;
}

const RESTORABLE_STATUSES = ["pending", "started", "active", "done"] as const;
type RestorableStatus = (typeof RESTORABLE_STATUSES)[number];

/**
 * Narrow the row `task.remove` returned into `task.restore` input (undo). The
 * row's `status` column is typed as a plain string, so an unknown value — which
 * the server would reject anyway — yields null and no Undo is offered.
 */
export function toRestoreInput<T extends { status: string }>(
  removed: T | null | undefined,
): (Omit<T, "status"> & { status: RestorableStatus }) | null {
  if (!removed) return null;
  const { status } = removed;
  if (!(RESTORABLE_STATUSES as readonly string[]).includes(status)) return null;
  return { ...removed, status: status as RestorableStatus };
}
