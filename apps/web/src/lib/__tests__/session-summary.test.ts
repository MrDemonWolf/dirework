import { describe, expect, it } from "vitest";

import { TIMER_CONFIG_DEFAULTS } from "@/lib/config-types";
import { formatSessionSummary } from "../session-summary";

describe("formatSessionSummary", () => {
  it("reads the defaults when the config has not loaded", () => {
    expect(formatSessionSummary(undefined)).toBe("FOCUS 25m · BREAK 5m · LONG 15m · EVERY 4");
    expect(formatSessionSummary(null)).toBe(formatSessionSummary(TIMER_CONFIG_DEFAULTS));
  });

  it("reads the saved config", () => {
    expect(
      formatSessionSummary({
        workDuration: 50 * 60_000,
        breakDuration: 10 * 60_000,
        longBreakDuration: 30 * 60_000,
        longBreakInterval: 3,
      }),
    ).toBe("FOCUS 50m · BREAK 10m · LONG 30m · EVERY 3");
  });

  it("fills a partial config from the defaults", () => {
    expect(formatSessionSummary({ workDuration: 45 * 60_000 })).toBe(
      "FOCUS 45m · BREAK 5m · LONG 15m · EVERY 4",
    );
  });

  it("rounds to whole minutes and never shows 0m", () => {
    expect(formatSessionSummary({ workDuration: 90_500, breakDuration: 10_000 })).toBe(
      "FOCUS 2m · BREAK 1m · LONG 15m · EVERY 4",
    );
  });
});
