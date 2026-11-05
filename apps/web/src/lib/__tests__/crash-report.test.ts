import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CRASH_REPORT_INTERVAL_MS,
  botCrashSurface,
  crashName,
  createCrashReporter,
  overlayCrashSurface,
} from "@/lib/crash-report";

describe("createCrashReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("sends at most one report per page per 10 minutes", () => {
    const send = vi.fn(async () => null);
    const report = createCrashReporter(send);

    expect(report("overlay_timer", "timer-token-0123", new TypeError("boom"))).toBe(true);
    // The boundary re-mounts every 10s and crashes again: none of those go out.
    for (let i = 0; i < 59; i++) {
      vi.advanceTimersByTime(10_000);
      expect(report("overlay_timer", "timer-token-0123", new TypeError("boom"))).toBe(false);
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      token: "timer-token-0123",
      surface: "overlay_timer",
      name: "TypeError",
    });

    vi.advanceTimersByTime(10_000);
    expect(CRASH_REPORT_INTERVAL_MS).toBe(600_000);
    expect(report("overlay_timer", "timer-token-0123", new RangeError("again"))).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sends nothing without a token, and never throws when the send fails", async () => {
    const send = vi.fn(async () => {
      throw new Error("offline");
    });
    const report = createCrashReporter(send);
    expect(report("bot_widget", undefined, new Error("x"))).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(report("bot_widget", "bot-token-0123", new Error("x"))).toBe(true);
    await vi.runAllTimersAsync();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("crashName", () => {
  it("keeps a safe constructor name and never the message", () => {
    expect(crashName(new TypeError("task text here"))).toBe("TypeError");
    const chunk = new Error("Loading chunk 12 failed");
    chunk.name = "ChunkLoadError";
    expect(crashName(chunk)).toBe("ChunkLoadError");
  });

  it("falls back to Error for anything not a safe token", () => {
    const named = new Error("x");
    named.name = "Cannot read properties of undefined";
    expect(crashName(named)).toBe("Error");
    named.name = "x".repeat(27);
    expect(crashName(named)).toBe("Error");
    expect(crashName("a string")).toBe("Error");
    expect(crashName(null)).toBe("Error");
  });
});

describe("surfaces", () => {
  it("tells the timer overlay from the task overlay by path", () => {
    expect(overlayCrashSurface("/overlay/t/abc")).toBe("overlay_timer");
    expect(overlayCrashSurface("/overlay/l/abc")).toBe("overlay_tasks");
    expect(overlayCrashSurface("/overlay/x/abc")).toBeNull();
    expect(overlayCrashSurface(null)).toBeNull();
  });

  it("names the bot view", () => {
    expect(botCrashSurface("widget")).toBe("bot_widget");
    expect(botCrashSurface("dock")).toBe("bot_dock");
  });
});

describe("wiring", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, "../../app", file), "utf8");

  it.each(["(overlay)/error.tsx", "(bot)/error.tsx"])(
    "%s reports direct to the api through one module-scope reporter",
    (file) => {
      const source = read(file);
      // publicTrpc goes straight to the api worker (no cookies, no web hop), and a static
      // import means nothing is fetched at crash time.
      expect(source).toContain(
        "createCrashReporter((input) => publicTrpc.crash.report.mutate(input))",
      );
      expect(source).toMatch(/^const reportCrash = /m);
      expect(source).toContain("reportCrash(surface, token, error)");
      expect(source).not.toMatch(/import\(/);
    },
  );

  it("the dashboard's boundary reports nothing: the owner is looking at it", () => {
    expect(read("(app)/error.tsx")).not.toContain("crash");
  });
});
