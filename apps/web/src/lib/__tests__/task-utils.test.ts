import { describe, expect, it } from "vitest";

import { groupTasksByAuthor } from "../task-utils";
import type { Task } from "../task-utils";

describe("groupTasksByAuthor", () => {
  it("should group tasks by authorTwitchId", () => {
    const tasks: Task[] = [
      { id: "1", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: "#ff0000", text: "Task A", status: "pending" },
      { id: "2", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: "#ff0000", text: "Task B", status: "done" },
      { id: "3", authorTwitchId: "tw2", authorDisplayName: "Bob", authorColor: "#00ff00", text: "Task C", status: "pending" },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups).toHaveLength(2);
    expect(groups[0].authorKey).toBe("tw1");
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[1].authorKey).toBe("tw2");
    expect(groups[1].tasks).toHaveLength(1);
  });

  it("should fall back to authorDisplayName when authorTwitchId is missing", () => {
    const tasks: Task[] = [
      { id: "1", authorDisplayName: "Charlie", authorColor: null, text: "Task A", status: "pending" },
      { id: "2", authorDisplayName: "Charlie", authorColor: null, text: "Task B", status: "pending" },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups).toHaveLength(1);
    expect(groups[0].authorKey).toBe("Charlie");
  });

  it("should count pending and done correctly", () => {
    const tasks: Task[] = [
      { id: "1", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "A", status: "pending" },
      { id: "2", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "B", status: "done" },
      { id: "3", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "C", status: "done" },
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
      { id: "1", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "First", status: "pending" },
      { id: "2", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "Second", status: "pending" },
      { id: "3", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "Third", status: "pending" },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].tasks[0].text).toBe("First");
    expect(groups[0].tasks[1].text).toBe("Second");
    expect(groups[0].tasks[2].text).toBe("Third");
  });

  it("should use first task's color and displayName for the group", () => {
    const tasks: Task[] = [
      { id: "1", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: "#ff0000", text: "A", status: "pending" },
      { id: "2", authorTwitchId: "tw1", authorDisplayName: "ALICE", authorColor: "#00ff00", text: "B", status: "pending" },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].authorDisplayName).toBe("Alice");
    expect(groups[0].authorColor).toBe("#ff0000");
  });

  it("should treat non-done statuses as pending count", () => {
    const tasks: Task[] = [
      { id: "1", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "A", status: "pending" },
      { id: "2", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "B", status: "in_progress" },
      { id: "3", authorTwitchId: "tw1", authorDisplayName: "Alice", authorColor: null, text: "C", status: "done" },
    ];

    const groups = groupTasksByAuthor(tasks);
    expect(groups[0].pending).toBe(2);
    expect(groups[0].done).toBe(1);
  });
});
