import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import {
  getTimerEta,
  maybeAdvanceOverdueTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
} from "../timer-service";

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

describe("pauseTimer guarded CAS", () => {
  it("re-reads instead of overwriting when a concurrent timer action wins", async () => {
    const running = {
      id: "singleton",
      status: "work",
      targetEndTime: new Date(Date.now() + 60_000),
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 1,
      totalCycles: 4,
    };
    const skipped = { ...running, status: "break" };
    const findFirst = vi.fn().mockResolvedValueOnce(running).mockResolvedValue(skipped);
    const setSpy = vi.fn();
    const db = {
      query: {
        timerState: { findFirst },
        timerConfig: { findFirst: async () => undefined },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setSpy(values);
          return { where: () => ({ returning: async () => [] }) };
        },
      }),
    } as unknown as DbClient;

    expect((await pauseTimer(db))?.status).toBe("break");
    expect(setSpy).toHaveBeenCalledOnce();
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});

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
    // null tells the chat command to reply notRunning instead of success.
    expect(await skipTimer(db)).toBeNull();
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
    expect(await skipTimer(db)).toBeNull();
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

describe("skipTimer guarded CAS vs a concurrent timer action", () => {
  const config = {
    workDuration: 10_000,
    breakDuration: 5_000,
    longBreakDuration: 20_000,
    longBreakInterval: 4,
    startingDuration: 1_000,
    noLastBreak: false,
    defaultCycles: 4,
  };

  it("does not double-advance when another action moves the timer first", async () => {
    // skip reads work → computes break, but a concurrent skip already moved
    // the row to break, so the guarded CAS matches no row (returning []). skip
    // must re-read and return that break state — NOT apply its own work→break
    // on top, which would land the timer a whole phase further along.
    const workRow = {
      id: "singleton",
      status: "work",
      targetEndTime: new Date(Date.now() + 1_000),
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 1,
      totalCycles: 4,
    };
    const advancedElsewhere = {
      ...workRow,
      status: "break",
      targetEndTime: new Date(Date.now() + config.breakDuration),
    };

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(workRow) // skip's initial read
      .mockResolvedValue(advancedElsewhere); // re-read after the lost CAS
    const setSpy = vi.fn();
    const db = {
      query: {
        timerState: { findFirst },
        timerConfig: { findFirst: async () => config },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setSpy(values);
          return { where: () => ({ returning: async () => [] }) }; // CAS lost
        },
      }),
    } as unknown as DbClient;

    const result = await skipTimer(db);

    // One (lost) write attempt, then accept the advanced state.
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ status: "break" });
    expect(result?.status).toBe("break");
    expect(result?.currentCycle).toBe(1);
    expect(result?.targetEndTime).toEqual(advancedElsewhere.targetEndTime);
  });

  it("advances an overdue phase first, so skip skips the phase that is actually current", async () => {
    // Work ended 1s ago and nothing has polled since: the real current phase is
    // the break. Skipping must skip that break, not restart it at full length.
    const { db, setSpy } = makeDb({
      timerState: {
        id: "singleton",
        status: "work",
        targetEndTime: new Date(Date.now() - 1_000),
        pausedWithRemaining: null,
        pausedFromStatus: null,
        currentCycle: 1,
        totalCycles: 4,
      },
      timerConfig: config,
    });

    await skipTimer(db);

    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ status: "break", currentCycle: 1 });
    expect(setSpy.mock.calls[1]?.[0]).toMatchObject({ status: "work", currentCycle: 2 });
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

describe("maybeAdvanceOverdueTimer (lazy read-driven transitions)", () => {
  // Short phases so multi-phase catch-up math stays readable.
  const config = {
    workDuration: 10_000,
    breakDuration: 5_000,
    longBreakDuration: 20_000,
    longBreakInterval: 4,
    startingDuration: 1_000,
    noLastBreak: false,
    defaultCycles: 4,
  };
  const base = {
    id: "singleton",
    pausedWithRemaining: null,
    pausedFromStatus: null,
    currentCycle: 1,
    totalCycles: 4,
  };

  it("leaves a still-running timer untouched", async () => {
    const { db, setSpy } = makeDb({
      timerState: { ...base, status: "work", targetEndTime: new Date(Date.now() + 60_000) },
      timerConfig: config,
    });
    const result = await maybeAdvanceOverdueTimer(db);
    expect(result?.status).toBe("work");
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("leaves paused / idle / missing timers untouched", async () => {
    for (const timerState of [
      { ...base, status: "paused", targetEndTime: null, pausedWithRemaining: 5_000 },
      { ...base, status: "idle", targetEndTime: null },
      undefined,
    ]) {
      const { db, setSpy } = makeDb({ timerState, timerConfig: config });
      await maybeAdvanceOverdueTimer(db);
      expect(setSpy).not.toHaveBeenCalled();
    }
  });

  it("advances one overdue work phase, anchoring the break at the old end time", async () => {
    const prevEnd = new Date(Date.now() - 1_000);
    const { db, setSpy } = makeDb({
      timerState: { ...base, status: "work", targetEndTime: prevEnd },
      timerConfig: config,
    });
    const result = await maybeAdvanceOverdueTimer(db);
    expect(result?.status).toBe("break");
    expect(setSpy).toHaveBeenCalledOnce();
    const written = setSpy.mock.calls[0]?.[0] as { targetEndTime: Date };
    expect(written.targetEndTime.getTime()).toBe(prevEnd.getTime() + config.breakDuration);
  });

  it("catches up through multiple missed phases in one read", async () => {
    // Overdue past the whole break too: work ended 6s ago, break is 5s.
    const prevEnd = new Date(Date.now() - 6_000);
    const { db, setSpy } = makeDb({
      timerState: { ...base, status: "work", targetEndTime: prevEnd },
      timerConfig: config,
    });
    const result = await maybeAdvanceOverdueTimer(db);
    // work → break (already over) → work (cycle 2, ends in the future), in ONE write
    expect(setSpy).toHaveBeenCalledOnce();
    expect(result?.status).toBe("work");
    expect(result?.currentCycle).toBe(2);
    const written = setSpy.mock.calls[0]?.[0] as { targetEndTime: Date };
    expect(written.targetEndTime.getTime()).toBe(
      prevEnd.getTime() + config.breakDuration + config.workDuration,
    );
  });

  it("keeps the write count constant for a long unattended run", async () => {
    // A 99-cycle session overdue by a day would need ~200 transitions; D1 caps
    // queries per invocation, so the catch-up must still be a single UPDATE.
    const { db, setSpy } = makeDb({
      timerState: {
        ...base,
        status: "work",
        totalCycles: 99,
        targetEndTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      timerConfig: config,
    });
    const result = await maybeAdvanceOverdueTimer(db);
    expect(setSpy).toHaveBeenCalledOnce();
    expect(result?.status).toBe("finished");
    expect(result?.currentCycle).toBe(99);
    expect(result?.targetEndTime).toBeNull();
  });

  it("re-reads instead of double-advancing when the guarded update loses the race", async () => {
    // Two clients (dashboard + overlay poll) read the same overdue work phase.
    // The other poller wins the guarded UPDATE (targetEndTime no longer
    // matches, so returning() is empty); this poller must re-read and accept
    // the advanced row — never apply its own transition on top (which would
    // skip the break). This is the property the dashboard relies on now that
    // its client-side auto-advance mutation is gone.
    const prevEnd = new Date(Date.now() - 1_000);
    const overdueWork = { ...base, status: "work", targetEndTime: prevEnd };
    const advancedByOther = {
      ...base,
      status: "break",
      targetEndTime: new Date(prevEnd.getTime() + config.breakDuration),
    };

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(overdueWork) // initial read: still overdue
      .mockResolvedValue(advancedByOther); // re-read after losing the race
    const setSpy = vi.fn();
    const db = {
      query: {
        timerState: { findFirst },
        timerConfig: { findFirst: async () => config },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setSpy(values);
          return { where: () => ({ returning: async () => [] }) };
        },
      }),
    } as unknown as DbClient;

    const result = await maybeAdvanceOverdueTimer(db);
    expect(result?.status).toBe("break");
    expect(result?.targetEndTime).toEqual(advancedByOther.targetEndTime);
    // Exactly one (lost) write attempt — the re-read row is in the future, so
    // the loop exits without stacking a second transition.
    expect(setSpy).toHaveBeenCalledOnce();
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("runs an overdue final phase into finished and stops", async () => {
    const prevEnd = new Date(Date.now() - 1_000);
    const { db, setSpy } = makeDb({
      timerState: {
        ...base,
        status: "break",
        currentCycle: 4,
        targetEndTime: prevEnd,
      },
      timerConfig: config,
    });
    const result = await maybeAdvanceOverdueTimer(db);
    expect(result?.status).toBe("finished");
    expect(setSpy).toHaveBeenCalledOnce();
    const written = setSpy.mock.calls[0]?.[0] as { targetEndTime: Date | null } | undefined;
    expect(written?.targetEndTime).toBeNull();
  });
});

describe("getTimerEta bounded projection", () => {
  it("returns a TimerEta via the iteration guard when the session needs >100 transitions", async () => {
    const { db } = makeDb({
      timerState: {
        status: "work",
        targetEndTime: new Date(Date.now() + 60_000),
        pausedWithRemaining: null,
        pausedFromStatus: null,
        currentCycle: 1,
        // ~2000 phase transitions without the guard — must not hang.
        totalCycles: 1000,
      },
    });

    const eta = await getTimerEta(db);

    expect(eta).not.toBeNull();
    expect(eta!.phaseEnd).toBeInstanceOf(Date);
    expect(eta!.sessionEnd.getTime()).toBeGreaterThan(eta!.phaseEnd.getTime());
  });
});
