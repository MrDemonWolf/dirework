import { MAX_STARTED_PER_AUTHOR } from "@dirework/api/config-defaults";
import { describe, expect, it } from "vitest";

import {
  canMarkTaskDone,
  countDoneByAuthor,
  groupTasksByAuthor,
  isAtStartCap,
  MAX_IN_PROGRESS,
  ownerInProgress,
  START_CAP_REASON,
  taskRowActions,
  toRestoreInput,
} from "../task-utils";
import type { Task } from "../task-utils";

describe("groupTasksByAuthor", () => {
  it("should group tasks by authorTwitchId", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: "#ff0000",
        text: "Task A",
        status: "pending",
      },
      {
        id: "2",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: "#ff0000",
        text: "Task B",
        status: "done",
      },
      {
        id: "3",
        authorTwitchId: "tw2",
        authorDisplayName: "Bob",
        authorColor: "#00ff00",
        text: "Task C",
        status: "pending",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups).toHaveLength(2);
    expect(groups[0].authorKey).toBe("tw1");
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[1].authorKey).toBe("tw2");
    expect(groups[1].tasks).toHaveLength(1);
  });

  it("keeps different Twitch IDs separate when their display names match", () => {
    const tasks: Task[] = [
      {
        id: "viewer-task",
        authorTwitchId: "viewer-9",
        authorDisplayName: "MrDemonWolf",
        authorColor: null,
        text: "Viewer task",
        status: "pending",
      },
      {
        id: "host-task",
        authorTwitchId: "owner-1",
        authorDisplayName: "MrDemonWolf",
        authorColor: null,
        text: "Host task",
        status: "active",
      },
    ];

    const groups = groupTasksByAuthor(tasks);

    expect(
      groups.map((group) => ({
        authorKey: group.authorKey,
        taskIds: group.tasks.map((task) => task.id),
      })),
    ).toEqual([
      { authorKey: "viewer-9", taskIds: ["viewer-task"] },
      { authorKey: "owner-1", taskIds: ["host-task"] },
    ]);
  });

  it("should fall back to authorDisplayName when authorTwitchId is missing", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorDisplayName: "Charlie",
        authorColor: null,
        text: "Task A",
        status: "pending",
      },
      {
        id: "2",
        authorDisplayName: "Charlie",
        authorColor: null,
        text: "Task B",
        status: "pending",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups).toHaveLength(1);
    expect(groups[0].authorKey).toBe("Charlie");
  });

  it("should count pending and done correctly", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "A",
        status: "pending",
      },
      {
        id: "2",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "B",
        status: "done",
      },
      {
        id: "3",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "C",
        status: "done",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].pending).toBe(1);
    expect(groups[0].done).toBe(2);
  });

  it("should return empty array for empty input", () => {
    const groups = groupTasksByAuthor([]);
    expect(groups).toEqual([]);
  });

  it("should preserve task order within groups", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "First",
        status: "pending",
      },
      {
        id: "2",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "Second",
        status: "pending",
      },
      {
        id: "3",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "Third",
        status: "pending",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].tasks[0].text).toBe("First");
    expect(groups[0].tasks[1].text).toBe("Second");
    expect(groups[0].tasks[2].text).toBe("Third");
  });

  it("should use first task's color and displayName for the group", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: "#ff0000",
        text: "A",
        status: "pending",
      },
      {
        id: "2",
        authorTwitchId: "tw1",
        authorDisplayName: "ALICE",
        authorColor: "#00ff00",
        text: "B",
        status: "pending",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].authorDisplayName).toBe("Alice");
    expect(groups[0].authorColor).toBe("#ff0000");
  });

  it("should treat non-done statuses as pending count", () => {
    const tasks: Task[] = [
      {
        id: "1",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "A",
        status: "pending",
      },
      {
        id: "2",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "B",
        status: "in_progress",
      },
      {
        id: "3",
        authorTwitchId: "tw1",
        authorDisplayName: "Alice",
        authorColor: null,
        text: "C",
        status: "done",
      },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].pending).toBe(2);
    expect(groups[0].done).toBe(1);
  });
});

describe("groupTasksByAuthor with server done counts", () => {
  const rows = [
    {
      id: "1",
      authorTwitchId: "a",
      authorDisplayName: "A",
      authorColor: null,
      text: "x",
      status: "pending",
    },
    {
      id: "2",
      authorTwitchId: "a",
      authorDisplayName: "A",
      authorColor: null,
      text: "y",
      status: "done",
    },
  ];

  it("takes each author's done total from the server, not the bounded rows", () => {
    const [group] = groupTasksByAuthor(rows, { a: 7 });
    expect(group).toMatchObject({ pending: 1, done: 7 });
  });

  it("counts done rows per author for an unbounded list", () => {
    expect(countDoneByAuthor(rows)).toEqual({ a: 1 });
  });
});

describe("canMarkTaskDone (the board's checkbox)", () => {
  it("completes every open status, including a parked started task", () => {
    expect(canMarkTaskDone("active")).toBe(true);
    expect(canMarkTaskDone("started")).toBe(true);
    expect(canMarkTaskDone("pending")).toBe(true);
  });

  it("is a no-op for done and unknown statuses", () => {
    expect(canMarkTaskDone("done")).toBe(false);
    expect(canMarkTaskDone("archived")).toBe(false);
  });
});

describe("toRestoreInput", () => {
  const removed = {
    id: "t1",
    authorTwitchId: "100",
    text: "write tests",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  };

  it("passes every field of the removed row through for a known status", () => {
    expect(toRestoreInput(removed)).toEqual(removed);
    expect(toRestoreInput({ ...removed, status: "started" })?.status).toBe("started");
  });

  it("offers no undo when nothing was removed or the status is unknown", () => {
    expect(toRestoreInput(null)).toBeNull();
    expect(toRestoreInput(undefined)).toBeNull();
    expect(toRestoreInput({ ...removed, status: "archived" })).toBeNull();
  });
});

describe("ownerInProgress", () => {
  const task = (id: string, author: string | undefined, name: string, status: string): Task => ({
    id,
    authorTwitchId: author,
    authorDisplayName: name,
    authorColor: null,
    text: `Task ${id}`,
    status,
  });

  it("returns the owner's focus and started tasks in list order, never a viewer's", () => {
    const tasks = [
      task("1", "viewer", "Viewer", "active"),
      task("2", "owner", "Owner", "started"),
      task("3", "owner", "Owner", "active"),
      task("4", "viewer", "Viewer", "started"),
      task("5", "owner", "Owner", "pending"),
      task("6", "owner", "Owner", "started"),
    ];
    const { focus, started } = ownerInProgress(tasks, "owner");
    expect(focus?.id).toBe("3");
    expect(started.map((t) => t.id)).toEqual(["2", "6"]);
  });

  it("has no focus when only viewers have one", () => {
    const tasks = [task("1", "viewer", "Viewer", "active"), task("2", "owner", "Owner", "done")];
    expect(ownerInProgress(tasks, "owner")).toEqual({ focus: null, started: [] });
  });

  it("matches nothing for an empty owner key (user.me not loaded yet)", () => {
    expect(ownerInProgress([task("1", undefined, "", "active")], "")).toEqual({
      focus: null,
      started: [],
    });
  });

  it("keys a task without a Twitch id by display name, like the board's groups", () => {
    expect(ownerInProgress([task("1", undefined, "Host", "active")], "Host").focus?.id).toBe("1");
  });
});

describe("isAtStartCap", () => {
  const rows = (...statuses: string[]) => statuses.map((status) => ({ status }));
  const started = (n: number) => Array.from({ length: n }, () => "started");

  it("is full with a focus and MAX_STARTED_PER_AUTHOR started tasks", () => {
    expect(isAtStartCap(rows("active", ...started(MAX_STARTED_PER_AUTHOR), "pending"))).toBe(true);
    expect(MAX_IN_PROGRESS).toBe(MAX_STARTED_PER_AUTHOR + 1);
    expect(START_CAP_REASON).toBe(`${MAX_IN_PROGRESS} in progress — finish or pause one`);
  });

  it("has room under the cap", () => {
    expect(isAtStartCap(rows("active", ...started(MAX_STARTED_PER_AUTHOR - 1), "pending"))).toBe(
      false,
    );
  });

  it("has room without a focus: Start then makes the task the focus", () => {
    expect(isAtStartCap(rows(...started(MAX_STARTED_PER_AUTHOR), "pending", "done"))).toBe(false);
  });
});

describe("taskRowActions", () => {
  const actions = (status: string) =>
    taskRowActions(status).map(({ action, inline }) => `${action}${inline ? "" : " (menu)"}`);

  it("offers Start on a pending task, with Make focus in the menu only", () => {
    expect(actions("pending")).toEqual(["start", "focus (menu)"]);
  });

  it("offers Make focus and Pause on a started task", () => {
    expect(actions("started")).toEqual(["focus", "pause"]);
  });

  it("offers only Pause on the focus", () => {
    expect(actions("active")).toEqual(["pause"]);
  });

  it("offers nothing on a done or unknown task", () => {
    expect(actions("done")).toEqual([]);
    expect(actions("archived")).toEqual([]);
  });
});
