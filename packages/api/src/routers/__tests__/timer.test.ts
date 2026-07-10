import { describe, it, expect } from "vitest";

// The REAL router input schema (env-free module) — the old transition-schema
// mirror died with the timer.transition procedure.
import { timerStartInput } from "../input-schemas";

describe("timer.start input validation", () => {
  it("accepts an empty input (totalCycles optional)", () => {
    const result = timerStartInput.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCycles).toBeUndefined();
    }
  });

  it.each([1, 4, 99])("accepts totalCycles=%d", (totalCycles) => {
    const result = timerStartInput.safeParse({ totalCycles });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCycles).toBe(totalCycles);
    }
  });

  it.each([0, -1, 100])("rejects out-of-range totalCycles=%d", (totalCycles) => {
    expect(timerStartInput.safeParse({ totalCycles }).success).toBe(false);
  });

  it("rejects a non-integer totalCycles", () => {
    expect(timerStartInput.safeParse({ totalCycles: 2.5 }).success).toBe(false);
  });

  it("rejects a string totalCycles", () => {
    expect(timerStartInput.safeParse({ totalCycles: "4" }).success).toBe(false);
  });
});
