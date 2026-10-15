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

/** Done tasks per author key, counted from rows (for full, unbounded lists). */
export function countDoneByAuthor(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.status !== "done") continue;
    const key = task.authorTwitchId || task.authorDisplayName;
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
    const key = task.authorTwitchId || task.authorDisplayName;
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

const RESTORABLE_STATUSES = ["pending", "active", "done"] as const;
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
