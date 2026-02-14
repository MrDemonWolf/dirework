import { describe, expect, it } from "vitest";

import { DEFAULTS, getTimerConfig, computeNextPhase } from "../timer-logic";
import type { TimerConfigInput } from "../timer-logic";

describe("getTimerConfig", () => {
  it("should return defaults when input is null", () => {
    const result = getTimerConfig(null);
    expect(result).toEqual(DEFAULTS);
  });

  it("should use provided values over defaults", () => {
    const custom: TimerConfigInput = {
      workDuration: 3000000,
      breakDuration: 600000,
      longBreakDuration: 1800000,
      longBreakInterval: 2,
      startingDuration: 10000,
      noLastBreak: false,
    };
    const result = getTimerConfig(custom);
    expect(result).toEqual(custom);
  });
});

describe("computeNextPhase", () => {
  const defaultConfig: TimerConfigInput = {
    workDuration: 1500000,
    breakDuration: 300000,
    longBreakDuration: 900000,
    longBreakInterval: 4,
    startingDuration: 5000,
    noLastBreak: true,
  };

  it("starting → work", () => {
    const result = computeNextPhase(
      { status: "starting", currentCycle: 1, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("work");
    expect(result.nextDuration).toBe(defaultConfig.workDuration);
    expect(result.nextCycle).toBe(1);
  });

  it("work → break (mid-session, not on longBreak interval)", () => {
    const result = computeNextPhase(
      { status: "work", currentCycle: 1, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("break");
    expect(result.nextDuration).toBe(defaultConfig.breakDuration);
    expect(result.nextCycle).toBe(1);
  });

  it("work → longBreak (on longBreakInterval boundary)", () => {
    const result = computeNextPhase(
      { status: "work", currentCycle: 4, totalCycles: 8 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("longBreak");
    expect(result.nextDuration).toBe(defaultConfig.longBreakDuration);
  });

  it("work → finished (last cycle, noLastBreak=true)", () => {
    const result = computeNextPhase(
      { status: "work", currentCycle: 4, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("finished");
    expect(result.nextDuration).toBeNull();
  });

  it("work → break (last cycle, noLastBreak=false)", () => {
    const config = { ...defaultConfig, noLastBreak: false };
    const result = computeNextPhase(
      { status: "work", currentCycle: 3, totalCycles: 3 },
      config,
    );
    expect(result.nextStatus).toBe("break");
    expect(result.nextDuration).toBe(config.breakDuration);
  });

  it("work → longBreak (last cycle, noLastBreak=false, on interval)", () => {
    const config = { ...defaultConfig, noLastBreak: false };
    const result = computeNextPhase(
      { status: "work", currentCycle: 4, totalCycles: 4 },
      config,
    );
    expect(result.nextStatus).toBe("longBreak");
    expect(result.nextDuration).toBe(config.longBreakDuration);
  });

  it("break → work (increment cycle)", () => {
    const result = computeNextPhase(
      { status: "break", currentCycle: 1, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("work");
    expect(result.nextDuration).toBe(defaultConfig.workDuration);
    expect(result.nextCycle).toBe(2);
  });

  it("longBreak → work (increment cycle)", () => {
    const result = computeNextPhase(
      { status: "longBreak", currentCycle: 4, totalCycles: 8 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("work");
    expect(result.nextDuration).toBe(defaultConfig.workDuration);
    expect(result.nextCycle).toBe(5);
  });

  it("break → finished (past totalCycles)", () => {
    const result = computeNextPhase(
      { status: "break", currentCycle: 4, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("finished");
    expect(result.nextDuration).toBeNull();
    expect(result.nextCycle).toBe(5);
  });

  it("longBreak → finished (past totalCycles)", () => {
    const result = computeNextPhase(
      { status: "longBreak", currentCycle: 4, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("finished");
    expect(result.nextDuration).toBeNull();
  });

  it("single cycle: work → finished (noLastBreak=true)", () => {
    const result = computeNextPhase(
      { status: "work", currentCycle: 1, totalCycles: 1 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("finished");
  });

  it("single cycle: work → break (noLastBreak=false)", () => {
    const config = { ...defaultConfig, noLastBreak: false };
    const result = computeNextPhase(
      { status: "work", currentCycle: 1, totalCycles: 1 },
      config,
    );
    expect(result.nextStatus).toBe("break");
  });

  it("unknown status returns same status with no duration change", () => {
    const result = computeNextPhase(
      { status: "idle", currentCycle: 1, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("idle");
    expect(result.nextDuration).toBeNull();
    expect(result.nextCycle).toBe(1);
  });

  it("finished status returns same status (no transition)", () => {
    const result = computeNextPhase(
      { status: "finished", currentCycle: 4, totalCycles: 4 },
      defaultConfig,
    );
    expect(result.nextStatus).toBe("finished");
    expect(result.nextDuration).toBeNull();
  });
});
