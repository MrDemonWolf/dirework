import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VIEWER_COMMAND_LIMIT,
  VIEWER_COMMAND_WINDOW_MS,
  createViewerThrottle,
} from "../viewer-throttle";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const run = (throttle: ReturnType<typeof createViewerThrottle>, id: string, n: number) =>
  Array.from({ length: n }, () => throttle.check(id));

describe("createViewerThrottle", () => {
  it("allows VIEWER_COMMAND_LIMIT commands per window, logs the first drop once", () => {
    const throttle = createViewerThrottle();

    expect(run(throttle, "42", VIEWER_COMMAND_LIMIT)).toEqual(
      Array(VIEWER_COMMAND_LIMIT).fill("allowed"),
    );
    expect(run(throttle, "42", 3)).toEqual(["throttled", "dropped", "dropped"]);
  });

  it("counts each viewer separately", () => {
    const throttle = createViewerThrottle();
    run(throttle, "42", VIEWER_COMMAND_LIMIT + 1);

    expect(throttle.check("43")).toBe("allowed");
  });

  it("is a rolling window: room comes back as the oldest command ages out", () => {
    const throttle = createViewerThrottle();
    throttle.check("42");
    vi.advanceTimersByTime(10_000);
    run(throttle, "42", VIEWER_COMMAND_LIMIT - 1);
    expect(throttle.check("42")).toBe("throttled");

    // The first command leaves the window: exactly one more fits.
    vi.advanceTimersByTime(VIEWER_COMMAND_WINDOW_MS - 10_000);
    expect(throttle.check("42")).toBe("allowed");
    expect(throttle.check("42")).toBe("throttled");

    // A full window later the viewer starts fresh.
    vi.advanceTimersByTime(VIEWER_COMMAND_WINDOW_MS);
    expect(run(throttle, "42", VIEWER_COMMAND_LIMIT)).toEqual(
      Array(VIEWER_COMMAND_LIMIT).fill("allowed"),
    );
  });

  it("dropped lines don't extend the penalty", () => {
    const throttle = createViewerThrottle();
    run(throttle, "42", VIEWER_COMMAND_LIMIT);
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(1000);
      throttle.check("42");
    }
    vi.advanceTimersByTime(VIEWER_COMMAND_WINDOW_MS - 20_000);
    expect(throttle.check("42")).toBe("allowed");
  });

  it("tracks a bounded number of viewers, forgetting idle ones first", () => {
    const throttle = createViewerThrottle({ maxViewers: 3 });
    run(throttle, "spammer", VIEWER_COMMAND_LIMIT);
    throttle.check("a");
    throttle.check("b");
    vi.advanceTimersByTime(VIEWER_COMMAND_WINDOW_MS);
    // Everyone is idle now; a new viewer evicts the expired entries, never errors.
    expect(throttle.check("c")).toBe("allowed");
    // The spammer's window had expired, so being forgotten loses nothing.
    expect(run(throttle, "spammer", VIEWER_COMMAND_LIMIT)).toEqual(
      Array(VIEWER_COMMAND_LIMIT).fill("allowed"),
    );
  });
});
