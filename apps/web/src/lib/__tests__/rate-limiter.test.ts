import { describe, expect, it } from "vitest";

import { RateLimiter } from "../rate-limiter";

const OPTS = { windowMs: 30_000, maxInWindow: 20, minGapMs: 1_000 };

describe("RateLimiter (Twitch chat limits)", () => {
  it("allows the first message immediately", () => {
    const rl = new RateLimiter(OPTS);
    expect(rl.nextAllowed(0)).toBe(0);
  });

  it("enforces the 1 msg/sec min gap", () => {
    const rl = new RateLimiter(OPTS);
    rl.record(0);
    // 500ms later still gated to the 1s boundary.
    expect(rl.nextAllowed(500)).toBe(1_000);
    // At/after the boundary, allowed immediately.
    expect(rl.nextAllowed(1_000)).toBe(1_000);
  });

  it("allows exactly 20 messages within a 30s window, then defers the 21st", () => {
    const rl = new RateLimiter(OPTS);
    // Space 20 sends 1s apart (satisfies the gap): t=0..19_000.
    for (let i = 0; i < 20; i++) {
      const t = i * 1_000;
      expect(rl.nextAllowed(t)).toBe(t);
      rl.record(t);
    }
    // 21st at t=19_500: window is full; must wait until the oldest (t=0)
    // exits the 30s window, i.e. t=30_000.
    expect(rl.nextAllowed(19_500)).toBe(30_000);
  });

  it("frees a slot once the oldest send ages out of the window", () => {
    const rl = new RateLimiter(OPTS);
    for (let i = 0; i < 20; i++) rl.record(i * 1_000); // t=0..19_000
    // At t=30_000 the t=0 send has aged out → one slot free, gap satisfied.
    expect(rl.nextAllowed(30_000)).toBe(30_000);
  });

  it("takes the max of the gap and window constraints", () => {
    const rl = new RateLimiter({ windowMs: 10_000, maxInWindow: 3, minGapMs: 1_000 });
    rl.record(0);
    rl.record(1_000);
    rl.record(2_000); // window now full (3)
    // Window constraint: oldest (t=0) + 10_000 = 10_000.
    // Gap constraint: last (t=2_000) + 1_000 = 3_000. Window wins.
    expect(rl.nextAllowed(2_500)).toBe(10_000);
  });
});
