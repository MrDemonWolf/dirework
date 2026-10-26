import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOT_LEASE_TTL_MS } from "@dirework/api/bot-lease";

import { nextBotPresenceCheckMs, scheduleBotPresenceCheck } from "../bot-presence";
import { dashboardBotChip } from "../bot-status";

const T0 = 1_000_000;

function fakeDocument(visible = true) {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: (visible ? "visible" : "hidden") as DocumentVisibilityState,
    addEventListener: vi.fn((_: string, fn: () => void) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: () => void) => listeners.delete(fn)),
  };
  const show = () => {
    doc.visibilityState = "visible";
    for (const fn of [...listeners]) fn();
  };
  return { doc: doc as unknown as Document, show, listeners };
}

/**
 * Drive the scheduler the way the dashboard hook does: one `user.me` answer at a time, re-armed
 * whenever a new answer lands (the refetch) or the scheduler asks to rerun.
 */
function dashboard(answers: (number | null)[], { visible = true } = {}) {
  const { doc, show, listeners } = fakeDocument(visible);
  const lastCheck = { current: Number.NEGATIVE_INFINITY };
  let seenMsAgo = answers.shift() ?? null;
  let fetchedAt = Date.now();
  let cleanup = () => {};
  const refetch = vi.fn(async () => {
    // The fresh answer lands a tick later; re-arm from it, like the hook's effect deps.
    await Promise.resolve();
    seenMsAgo = answers.length > 0 ? (answers.shift() ?? null) : seenMsAgo;
    fetchedAt = Date.now();
    arm();
  });
  const arm = () => {
    cleanup();
    cleanup = scheduleBotPresenceCheck({
      seenMsAgo,
      fetchedAt,
      lastCheck,
      refetch,
      rerun: arm,
      doc,
    });
  };
  arm();
  return { refetch, show, listeners, chip: () => dashboardBotChip(true, seenMsAgo).label };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("nextBotPresenceCheckMs", () => {
  it("checks when the lease in the answer would run out, never for an offline answer", async () => {
    expect(
      nextBotPresenceCheckMs({
        seenMsAgo: 60_000,
        fetchedAt: T0,
        lastCheckAt: Number.NEGATIVE_INFINITY,
        now: T0,
      }),
    ).toBe(BOT_LEASE_TTL_MS - 60_000);
    for (const seenMsAgo of [null, BOT_LEASE_TTL_MS]) {
      expect(
        nextBotPresenceCheckMs({ seenMsAgo, fetchedAt: T0, lastCheckAt: 0, now: T0 }),
      ).toBeNull();
    }
  });

  it("never checks sooner than a lease window after the previous check", async () => {
    expect(
      nextBotPresenceCheckMs({
        seenMsAgo: 200_000,
        fetchedAt: T0,
        lastCheckAt: T0 - 1000,
        now: T0,
      }),
    ).toBe(BOT_LEASE_TTL_MS - 1000);
  });
});

describe("scheduleBotPresenceCheck", () => {
  it("keeps a renewing bot connected: refetches at the deadline instead of going offline", async () => {
    // The bot renews every 2 min, so every fresh answer is at most 2 min old.
    const view = dashboard([60_000, 30_000, 90_000, 0]);
    expect(view.chip()).toBe("Bot connected");

    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS - 60_000 - 1);
    expect(view.refetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.refetch).toHaveBeenCalledTimes(1);
    expect(view.chip()).toBe("Bot connected");

    // About one refetch per lease window while it keeps running, never faster.
    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS * 3);
    expect(view.refetch).toHaveBeenCalledTimes(4);
    expect(view.chip()).toBe("Bot connected");
  });

  it("goes offline only when the fresh answer is stale, then stops checking", async () => {
    const view = dashboard([60_000, null]);
    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS - 60_000);
    expect(view.refetch).toHaveBeenCalledTimes(1);
    expect(view.chip()).toBe("Bot offline");

    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS * 10);
    expect(view.refetch).toHaveBeenCalledTimes(1);
  });

  it("never schedules anything while no bot page runs", async () => {
    const view = dashboard([null]);
    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS * 10);
    expect(view.refetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for a hidden tab to come back before refetching", async () => {
    const view = dashboard([60_000, 0], { visible: false });
    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS * 3);
    expect(view.refetch).not.toHaveBeenCalled();
    expect(view.chip()).toBe("Bot connected");

    view.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.refetch).toHaveBeenCalledTimes(1);
    expect(view.listeners.size).toBe(0);
  });

  it("looks again a lease window after a refetch that brought no new answer", async () => {
    const { doc } = fakeDocument();
    const lastCheck = { current: Number.NEGATIVE_INFINITY };
    const refetch = vi.fn();
    const rerun = vi.fn();
    scheduleBotPresenceCheck({ seenMsAgo: 0, fetchedAt: T0, lastCheck, refetch, rerun, doc });

    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(rerun).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(BOT_LEASE_TTL_MS);
    expect(rerun).toHaveBeenCalledTimes(1);
  });
});
