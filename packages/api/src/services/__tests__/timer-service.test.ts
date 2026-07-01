import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import { resetTimer, resumeTimer, skipTimer } from "../timer-service";

interface StubOptions {
  timerState?: Record<string, unknown>;
  timerConfig?: Record<string, unknown>;
}

/** Minimal DbClient stub: relational reads + a capturing update chain. */
function makeDb(opts: StubOptions) {
  const setSpy = vi.fn();
  const db = {
    query: {
      timerState: { findFirst: async () => opts.timerState },
      timerConfig: { findFirst: async () => opts.timerConfig },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        setSpy(values);
        return {
          where: () => ({
            returning: async () => [{ ...opts.timerState, ...values }],
          }),
        };
      },
    }),
  } as unknown as DbClient;
  return { db, setSpy };
}

describe("resumeTimer (audit M2)", () => {
  const pausedBase = {
    id: "singleton",
    status: "paused",
    targetEndTime: null,
    pausedFromStatus: "work",
    currentCycle: 1,
    totalCycles: 4,
  };

  it("resumes a timer paused with exactly 0ms remaining (nullish, not falsy)", async () => {
    const { db, setSpy } = makeDb({ timerState: { ...pausedBase, pausedWithRemaining: 0 } });
    const result = await resumeTimer(db);
    expect(result).not.toBeNull();
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({
      status: "work",
      pausedWithRemaining: null,
      pausedFromStatus: null,
    });
  });

  it("returns null (no write) when the timer was never paused", async () => {
    const { db, setSpy } = makeDb({ timerState: { ...pausedBase, pausedWithRemaining: null } });
    expect(await resumeTimer(db)).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("returns null when no timer row exists", async () => {
    const { db, setSpy } = makeDb({ timerState: undefined });
    expect(await resumeTimer(db)).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe("skipTimer no-op guard (audit L6)", () => {
  it("does not write when skipping from idle", async () => {
    const idle = {
      id: "singleton",
      status: "idle",
      targetEndTime: null,
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 1,
      totalCycles: 4,
    };
    const { db, setSpy } = makeDb({ timerState: idle });
    const result = await skipTimer(db);
    expect(result).toEqual(idle);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("does not write when skipping from finished", async () => {
    const finished = {
      id: "singleton",
      status: "finished",
      targetEndTime: null,
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 4,
      totalCycles: 4,
    };
    const { db, setSpy } = makeDb({ timerState: finished });
    const result = await skipTimer(db);
    expect(result).toEqual(finished);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("still writes when skipping a paused work phase", async () => {
    const paused = {
      id: "singleton",
      status: "paused",
      targetEndTime: null,
      pausedWithRemaining: 120000,
      pausedFromStatus: "work",
      currentCycle: 1,
      totalCycles: 4,
    };
    const { db, setSpy } = makeDb({ timerState: paused });
    const result = await skipTimer(db);
    expect(result).not.toBeNull();
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ status: "break" });
  });
});

describe("resetTimer uses configured defaultCycles (audit L4)", () => {
  it("resets totalCycles to timerConfig.defaultCycles, not a literal 4", async () => {
    const { db, setSpy } = makeDb({
      timerState: { id: "singleton", status: "work", currentCycle: 3, totalCycles: 9 },
      timerConfig: { defaultCycles: 7 },
    });
    await resetTimer(db);
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({
      status: "idle",
      currentCycle: 1,
      totalCycles: 7,
    });
  });

  it("falls back to DEFAULTS.defaultCycles when no config row exists", async () => {
    const { db, setSpy } = makeDb({
      timerState: { id: "singleton", status: "work", currentCycle: 2, totalCycles: 9 },
      timerConfig: undefined,
    });
    await resetTimer(db);
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ totalCycles: 4 });
  });
});
