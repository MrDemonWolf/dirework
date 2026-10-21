import { describe, expect, it } from "vitest";

import {
  DASHBOARD_IDLE_AFTER_MS,
  DASHBOARD_IDLE_POLL_MS,
  DASHBOARD_TASKS_POLL_MS,
  DASHBOARD_TIMER_POLL_MS,
  DASHBOARD_TIMER_QUERY_OPTS,
  dashboardPollInterval,
  idleAwareInterval,
  OVERLAY_POLL_MS,
} from "../poll-intervals";

describe("idleAwareInterval", () => {
  const now = 10 * DASHBOARD_IDLE_AFTER_MS;

  it("keeps the active cadence while the owner is interacting", () => {
    expect(idleAwareInterval(DASHBOARD_TIMER_POLL_MS, now, now - 1000)).toBe(
      DASHBOARD_TIMER_POLL_MS,
    );
    expect(idleAwareInterval(DASHBOARD_TASKS_POLL_MS, now, now - DASHBOARD_IDLE_AFTER_MS + 1)).toBe(
      DASHBOARD_TASKS_POLL_MS,
    );
  });

  it("slows to the idle cadence once the owner has been idle long enough", () => {
    expect(idleAwareInterval(DASHBOARD_TIMER_POLL_MS, now, now - DASHBOARD_IDLE_AFTER_MS)).toBe(
      DASHBOARD_IDLE_POLL_MS,
    );
  });

  it("never speeds up a cadence that is already slower than the idle one", () => {
    expect(idleAwareInterval(60_000, now, 0)).toBe(60_000);
  });
});

describe("dashboardPollInterval", () => {
  it("starts at the active cadence (a fresh page counts as activity)", () => {
    expect(dashboardPollInterval(DASHBOARD_TASKS_POLL_MS)()).toBe(DASHBOARD_TASKS_POLL_MS);
    expect(DASHBOARD_TIMER_QUERY_OPTS.refetchInterval()).toBe(DASHBOARD_TIMER_POLL_MS);
  });
});

describe("OVERLAY_POLL_MS", () => {
  // Both OBS overlays poll all stream long, even in the background: the largest steady
  // Worker request and D1 read cost on the free plan. A faster poll needs a stated
  // request-budget reason (AGENTS.md), so this pin must be changed deliberately.
  it("polls every 5s", () => {
    expect(OVERLAY_POLL_MS).toBe(5000);
  });

  it("never polls faster than every 5s", () => {
    expect(OVERLAY_POLL_MS).toBeGreaterThanOrEqual(5000);
  });
});
