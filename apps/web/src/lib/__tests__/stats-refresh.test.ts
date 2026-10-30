import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeStatsRefresh } from "../stats-refresh";

const timerKey = [["timer", "get"], { type: "query" }];
const tasksKey = [["task", "list"], { type: "query" }];
const statsKey = [["stats", "summary"], { type: "query" }];

const timer = (status: string, cycle: number, end: string) => ({
  status,
  currentCycle: cycle,
  totalCycles: 4,
  targetEndTime: end,
});
const tasks = (...completedAt: string[]) => ({
  tasks: completedAt.map((at, i) => ({ id: `t${i}`, status: "done", completedAt: at })),
  counts: { open: 0, done: completedAt.length, doneByAuthor: {} },
});

let queryClient: QueryClient;
let fetches: number;
let unsubscribe: () => void;

beforeEach(async () => {
  queryClient = new QueryClient();
  fetches = 0;
  queryClient.setQueryData(timerKey, timer("work", 1, "2026-10-26T10:25:00Z"));
  queryClient.setQueryData(tasksKey, tasks("2026-10-26T09:00:00Z"));
  // The stats query is mounted (an active observer), like the dashboard's tiles.
  const observer = new QueryObserver(queryClient, {
    queryKey: statsKey,
    queryFn: async () => {
      fetches += 1;
      return { fetches };
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
  observer.subscribe(() => {});
  await vi.waitFor(() => expect(fetches).toBe(1));
  fetches = 0;
  unsubscribe = subscribeStatsRefresh(queryClient, { timerKey, tasksKey, statsKey });
});

afterEach(() => {
  unsubscribe();
  queryClient.clear();
});

/** Let every refetch the change started settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

describe("subscribeStatsRefresh", () => {
  it("refetches the summary exactly once per new timer phase", async () => {
    queryClient.setQueryData(timerKey, timer("break", 1, "2026-10-26T10:30:00Z"));
    await settle();
    expect(fetches).toBe(1);

    // The next poll of the same phase changes nothing.
    queryClient.setQueryData(timerKey, timer("break", 1, "2026-10-26T10:30:00Z"));
    await settle();
    expect(fetches).toBe(1);
  });

  it("refetches exactly once per new task completion", async () => {
    queryClient.setQueryData(tasksKey, tasks("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z"));
    await settle();
    expect(fetches).toBe(1);
  });

  it("ignores the stats query's own events and unrelated queries", async () => {
    await queryClient.invalidateQueries({ queryKey: statsKey });
    queryClient.setQueryData([["config", "get"], { type: "query" }], { any: "thing" });
    await settle();
    // Only the explicit invalidation above; nothing re-entered the check.
    expect(fetches).toBe(1);
  });

  it("stops after unsubscribe", async () => {
    unsubscribe();
    queryClient.setQueryData(timerKey, timer("break", 1, "2026-10-26T10:30:00Z"));
    await settle();
    expect(fetches).toBe(0);
  });
});
