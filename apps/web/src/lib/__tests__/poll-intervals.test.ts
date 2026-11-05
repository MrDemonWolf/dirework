import {
  environmentManager,
  focusManager,
  isServer,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOT_LEASE_TTL_MS } from "@dirework/api/bot-lease";

import {
  BOT_HEARTBEAT_MS,
  DASHBOARD_IDLE_AFTER_MS,
  DASHBOARD_IDLE_POLL_MS,
  DASHBOARD_TASKS_POLL_MS,
  DASHBOARD_TIMER_POLL_MS,
  DASHBOARD_TIMER_QUERY_OPTS,
  dashboardPollInterval,
  idleAwareInterval,
  NOT_CONFIGURED_POLL_MS,
  OVERLAY_POLL_MS,
  OVERLAY_POLL_QUERY_OPTS,
  QUERY_FRESH_MS,
  REVALIDATE_INTERVAL_MS,
  VERSION_CHECK_MS,
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

describe("OVERLAY_POLL_QUERY_OPTS", () => {
  // Both overlay pages spread these, then set `refetchIntervalInBackground: !preview`
  // (pinned in overlay-preview.test.ts). Driven through a real QueryClient with the app's
  // staleTime, as the browser runs it: fake timers for the interval, focusManager for a
  // hidden tab (an iframe's document is hidden whenever its tab is).
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    // Node reads as a server, where React Query never polls: run the browser's interval.
    environmentManager.setIsServer(() => false);
    queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_FRESH_MS } } });
    // What QueryClientProvider does: refetch stale queries when the tab is shown again.
    queryClient.mount();
  });

  afterEach(() => {
    queryClient.unmount();
    queryClient.clear();
    focusManager.setFocused(undefined);
    environmentManager.setIsServer(() => isServer);
    vi.useRealTimers();
  });

  /** Mount one overlay page's poll and count its fetches, starting with the first load. */
  async function mountOverlayPoll(preview: boolean) {
    const poll = { fetches: 0 };
    const observer = new QueryObserver(queryClient, {
      queryKey: ["overlay", "timerState", preview ? "preview" : "obs"],
      queryFn: async () => ++poll.fetches,
      ...OVERLAY_POLL_QUERY_OPTS,
      refetchIntervalInBackground: !preview,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(poll.fetches).toBe(1);
    return { poll, unsubscribe };
  }

  it("never toasts a failed poll onto the stream", () => {
    expect(OVERLAY_POLL_QUERY_OPTS.meta).toEqual({ silent: true });
  });

  it("keeps an OBS source (the plain URL) polling every OVERLAY_POLL_MS while hidden", async () => {
    const { poll, unsubscribe } = await mountOverlayPoll(false);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(3 * OVERLAY_POLL_MS);
    expect(poll.fetches).toBe(4);
    unsubscribe();
  });

  it("stops the dashboard's preview while its tab is hidden and refreshes it once on return", async () => {
    const { poll, unsubscribe } = await mountOverlayPoll(true);
    // Visible: the overlay cadence, like an OBS source.
    await vi.advanceTimersByTimeAsync(OVERLAY_POLL_MS);
    expect(poll.fetches).toBe(2);

    // Hidden for longer than QUERY_FRESH_MS: every tick is skipped.
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(2 * QUERY_FRESH_MS);
    expect(poll.fetches).toBe(2);

    // Shown again: one focus refetch of the stale payload, then the overlay cadence.
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(poll.fetches).toBe(3);
    await vi.advanceTimersByTimeAsync(OVERLAY_POLL_MS);
    expect(poll.fetches).toBe(4);
    unsubscribe();
  });
});

describe("BOT_HEARTBEAT_MS", () => {
  it("is 2 minutes, at most half the 5-minute bot lease, so one lost check-in never drops the bot", () => {
    // 30 requests and 30 D1 writes an hour per open bot page: the owner-approved budget.
    expect(BOT_HEARTBEAT_MS).toBe(2 * 60_000);
    expect(BOT_HEARTBEAT_MS * 2).toBeLessThanOrEqual(BOT_LEASE_TTL_MS);
  });
});

describe("the bot page's other cadences", () => {
  // Both re-run bot.getSession, one Worker request each (plus its D1 reads).
  it("revalidates the chat token hourly: 24 requests a day per running bot page", () => {
    expect(REVALIDATE_INTERVAL_MS).toBe(60 * 60_000);
  });

  it("looks for a bot account every minute: at most 1,440 requests a day per parked page", () => {
    expect(NOT_CONFIGURED_POLL_MS).toBe(60_000);
  });
});

describe("VERSION_CHECK_MS", () => {
  // One web-Worker request per check (/api/version is no-store), in the owner's visible tab
  // only. A deploy only needs noticing within minutes, so this never gets faster.
  it("checks for a new deploy no more than every 5 minutes", () => {
    expect(VERSION_CHECK_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });
});
