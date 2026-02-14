export { toHexOpacity } from "@/lib/timer-utils";

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

export function groupTasksByAuthor(tasks: Task[]): TaskGroup[] {
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
  return Array.from(groups.values());
}
