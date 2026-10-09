import { describe, expect, it } from "vitest";

import { TIMER_STATUSES } from "@dirework/api/config-shared";

import { TIMER_PHASE_COLOR, TIMER_TONES, toTimerStatus } from "../status-tones";

describe("toTimerStatus", () => {
  it("passes every known status through", () => {
    for (const status of TIMER_STATUSES) {
      expect(toTimerStatus(status)).toBe(status);
    }
  });

  it("falls back to idle for unknown strings", () => {
    expect(toTimerStatus("mystery")).toBe("idle");
  });

  it("ignores inherited object keys", () => {
    expect(toTimerStatus("constructor")).toBe("idle");
    expect(toTimerStatus("toString")).toBe("idle");
  });
});

describe("timer status maps", () => {
  it("cover every status", () => {
    for (const status of TIMER_STATUSES) {
      expect(TIMER_TONES[status]).toBeDefined();
      expect(TIMER_PHASE_COLOR[status]).toBeDefined();
    }
  });
});
