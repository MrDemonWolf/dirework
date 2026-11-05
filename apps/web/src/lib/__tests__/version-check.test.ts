import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VERSION_CHECK_MS } from "../poll-intervals";
import { fetchDeployedSha, scheduleVersionCheck } from "../version-check";

/** The SHA this tab was built from, and a later deploy's. */
const BUILT = "413ff22";
const NEWER = "9aa0fd0";

const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");

function fakeDocument(visible: boolean) {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: (visible ? "visible" : "hidden") as DocumentVisibilityState,
    addEventListener: vi.fn((_: string, fn: () => void) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: () => void) => listeners.delete(fn)),
  };
  const set = (state: DocumentVisibilityState) => {
    doc.visibilityState = state;
    for (const fn of [...listeners]) fn();
  };
  return {
    doc: doc as unknown as Document,
    show: () => set("visible"),
    hide: () => set("hidden"),
    listeners,
  };
}

/** A tab built from BUILT whose `/api/version` answers `live` (undefined = a failed check). */
function tab({ visible = true, live = BUILT as string | undefined } = {}) {
  const page = fakeDocument(visible);
  const fetchVersion = vi.fn(async () => live);
  const onStale = vi.fn();
  const stop = scheduleVersionCheck({ sha: BUILT, onStale, fetchVersion, doc: page.doc });
  return { ...page, fetchVersion, onStale, stop };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("scheduleVersionCheck", () => {
  it("checks once per VERSION_CHECK_MS while the tab is visible", async () => {
    const view = tab();
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS - 1);
    expect(view.fetchVersion).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 2);
    expect(view.fetchVersion).toHaveBeenCalledTimes(3);
    expect(view.onStale).not.toHaveBeenCalled();
  });

  it("never checks while the tab is hidden, and holds no timer there", async () => {
    const view = tab({ visible: false });
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 3);
    expect(view.fetchVersion).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    // Back after more than an interval: one check at once, then the visible cadence.
    view.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS);
    expect(view.fetchVersion).toHaveBeenCalledTimes(2);
  });

  it("skips the checks that fall due while the tab is in the background", async () => {
    const view = tab();
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);

    view.hide();
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 3);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("checks on a return only once VERSION_CHECK_MS has passed since the last check", async () => {
    const view = tab();
    // Away for a minute, a minute after the page loaded: nothing to check yet.
    await vi.advanceTimersByTimeAsync(60_000);
    view.hide();
    await vi.advanceTimersByTimeAsync(60_000);
    view.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.fetchVersion).not.toHaveBeenCalled();

    // The regular check still runs on time, and a quick tab switch after it adds none.
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS - 2 * 60_000);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);
    view.hide();
    view.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);

    // Away past the next check: coming back checks at once, then on the cadence from there.
    view.hide();
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS + 60_000);
    view.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.fetchVersion).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS - 1);
    expect(view.fetchVersion).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(view.fetchVersion).toHaveBeenCalledTimes(3);
  });

  it("stops for good once a newer deploy is live", async () => {
    const view = tab({ live: NEWER });
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);
    expect(view.onStale).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 3);
    view.hide();
    view.show();
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 3);
    expect(view.fetchVersion).toHaveBeenCalledTimes(1);
    expect(view.onStale).toHaveBeenCalledTimes(1);
    expect(view.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps checking after a failed check, without calling the tab stale", async () => {
    const view = tab({ live: undefined });
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 2);
    expect(view.fetchVersion).toHaveBeenCalledTimes(2);
    expect(view.onStale).not.toHaveBeenCalled();
  });

  it("stops everything on cleanup (the badge unmounting)", async () => {
    const view = tab();
    view.stop();
    expect(view.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS * 3);
    expect(view.fetchVersion).not.toHaveBeenCalled();
  });
});

describe("fetchDeployedSha", () => {
  it("reads the SHA the web Worker serves now, past the HTTP cache", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ sha: NEWER }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchDeployedSha()).resolves.toBe(NEWER);
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
  });

  it("answers undefined for a failed check, so a blip never flags the tab stale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    await expect(fetchDeployedSha()).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(fetchDeployedSha()).resolves.toBeUndefined();
  });
});

describe("VersionBadge wiring", () => {
  it("checks for a new deploy only in the signed-in owner's tab", () => {
    // Viewers on / and /setup get the static SHA: no /api/version request at all.
    expect(read("app/(app)/layout.tsx")).toMatch(
      /<VersionBadge\s+sha=\{commitSha\}\s+checkForUpdates=\{session\?\.user\?\.isOwner === true\}\s*\/>/,
    );
  });

  it("schedules through version-check.ts, never a timer, listener or fetch of its own", () => {
    const badge = read("components/version-badge.tsx");
    expect(badge).toContain("scheduleVersionCheck(");
    expect(badge).not.toMatch(/setInterval|setTimeout|visibilitychange|fetch\(/);
  });
});
