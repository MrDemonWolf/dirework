import { readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryObserver, queryOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeStatsRefresh } from "../stats-refresh";
import { applyTimerResult } from "../timer-cache";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

interface TimerRow {
  status: string;
  currentCycle: number;
  totalCycles: number;
  targetEndTime: string | null;
}

const idle: TimerRow = { status: "idle", currentCycle: 1, totalCycles: 4, targetEndTime: null };
const starting: TimerRow = { ...idle, status: "starting", targetEndTime: "2026-11-05T10:00:05Z" };
const paused: TimerRow = { ...idle, status: "paused", currentCycle: 2 };

/** The timer as the server has it: what a `timer.get` read answers. */
let server: TimerRow | null;
/** Set while a read is on the wire: a read that leaves now waits for it before answering. */
let wire: Promise<void> | null;
let reads: number;

const timer = queryOptions({
  queryKey: [["timer", "get"], { type: "query" }],
  queryFn: async (): Promise<TimerRow | null> => {
    reads += 1;
    // The server reads the row when the request arrives; the answer may arrive much later.
    const answer = server;
    const delivery = wire;
    if (delivery) await delivery;
    return answer;
  },
});

let queryClient: QueryClient;
let unsubscribe: () => void;

beforeEach(async () => {
  server = idle;
  wire = null;
  reads = 0;
  queryClient = new QueryClient();
  // The console's poll: an active observer, so an invalidation would refetch at once.
  const observer = new QueryObserver(queryClient, {
    ...timer,
    staleTime: Number.POSITIVE_INFINITY,
  });
  unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(queryClient.getQueryData(timer.queryKey)).toEqual(idle));
  reads = 0;
});

afterEach(() => {
  unsubscribe();
  queryClient.clear();
});

/** Let every fetch the change started settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

describe("applyTimerResult", () => {
  it("writes the action's answer into the cache and never re-reads timer.get", async () => {
    server = starting;
    await applyTimerResult(queryClient, timer.queryKey, starting);
    // Already there when the promise settles, so the mutation's pending state covers it.
    expect(queryClient.getQueryData(timer.queryKey)).toEqual(starting);
    await settle();
    expect(reads).toBe(0);
  });

  it("re-reads the timer once when the action changed nothing", async () => {
    // Chat paused the timer while the console still showed it running; the dashboard's own
    // pause then finds nothing to do and answers null.
    server = paused;
    await applyTimerResult(queryClient, timer.queryKey, null);
    expect(reads).toBe(1);
    expect(queryClient.getQueryData(timer.queryKey)).toEqual(paused);
  });

  it("cancels a poll still on the wire, so the phase it read before the write never lands", async () => {
    let deliver!: () => void;
    wire = new Promise<void>((resolve) => {
      deliver = resolve;
    });
    void queryClient.refetchQueries({ queryKey: timer.queryKey });
    await vi.waitFor(() => expect(reads).toBe(1));
    wire = null;

    server = starting;
    await applyTimerResult(queryClient, timer.queryKey, starting);
    // The poll's answer (read while the timer was idle) arrives after the write's.
    deliver();
    await settle();
    expect(queryClient.getQueryData(timer.queryKey)).toEqual(starting);
    expect(reads).toBe(1);
  });

  it("still refreshes the stats once per new phase", async () => {
    const statsKey = [["stats", "summary"], { type: "query" }];
    let statsReads = 0;
    const stats = new QueryObserver(queryClient, {
      queryKey: statsKey,
      queryFn: async () => ({ statsReads: ++statsReads }),
      staleTime: Number.POSITIVE_INFINITY,
    });
    const stopStats = stats.subscribe(() => {});
    // Landed, not just started: a refresh during the first fetch would join it, not refetch.
    await vi.waitFor(() => expect(queryClient.getQueryData(statsKey)).toBeDefined());
    statsReads = 0;
    const stopRefresh = subscribeStatsRefresh(queryClient, {
      timerKey: timer.queryKey,
      tasksKey: [["task", "list"], { type: "query" }],
      statsKey,
    });
    try {
      server = starting;
      await applyTimerResult(queryClient, timer.queryKey, starting);
      await settle();
      expect(statsReads).toBe(1);

      // The same answer again (a second click that changed nothing new) is no new phase.
      await applyTimerResult(queryClient, timer.queryKey, starting);
      await settle();
      expect(statsReads).toBe(1);
    } finally {
      stopRefresh();
      stopStats();
    }
  });
});

describe("the dashboard timer console", () => {
  const controls = read("components/timer-controls.tsx");

  it.each(["start", "pause", "resume", "skip", "reset"])(
    "timer.%s writes its answer into the cache",
    (action) => {
      expect(controls).toMatch(
        new RegExp(
          `\\.\\.\\.trpc\\.timer\\.${action}\\.mutationOptions\\(\\),\\s*onSuccess: applyResult,`,
        ),
      );
    },
  );

  it("never re-reads timer.get after an action", () => {
    expect(controls).toContain("applyTimerResult(queryClient, timerKey, row)");
    expect(controls).not.toMatch(
      /invalidateQueries\(\{\s*queryKey: trpc\.timer\.get\.queryKey\(\)/,
    );
  });
});
