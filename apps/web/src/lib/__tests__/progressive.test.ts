import { readFileSync } from "node:fs";
import path from "node:path";

import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SECTIONS_READY_MS, sectionsReady, sectionWait } from "@/lib/progressive";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Whether `promise` has settled once the queued microtasks drain. */
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(
    () => (done = true),
    () => (done = true),
  );
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return done;
}

describe("sectionsReady (the first-paint deadline)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves as soon as every query settles, well before the deadline (fast load)", async () => {
    vi.useFakeTimers();
    const me = deferred<string>();
    const tasks = deferred<string>();
    const ready = sectionsReady([me.promise, tasks.promise]);

    me.resolve("me");
    expect(await isSettled(ready)).toBe(false);
    tasks.resolve("tasks");
    expect(await isSettled(ready)).toBe(true);
    // The deadline timer was cleared, not left to fire later.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves at the deadline while a slow query is still running (slow load)", async () => {
    vi.useFakeTimers();
    const slow = deferred<string>();
    const ready = sectionsReady([Promise.resolve("me"), slow.promise]);

    await vi.advanceTimersByTimeAsync(SECTIONS_READY_MS - 1);
    expect(await isSettled(ready)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await isSettled(ready)).toBe(true);
  });

  it("counts a failure as settled and never rejects", async () => {
    vi.useFakeTimers();
    const failing = deferred<string>();
    const ready = sectionsReady([failing.promise]);
    failing.reject(new Error("api down"));
    await expect(ready).resolves.toBeUndefined();
  });

  it("keeps the deadline above a production batch plus React's 300ms reveal throttle, under ~1s", () => {
    // Below ~450ms a batch landing just late would finish later partial (throttled) than held.
    expect(SECTIONS_READY_MS).toBeGreaterThanOrEqual(450);
    // Session check + deadline must stay inside the ~1s flow limit for a first paint.
    expect(SECTIONS_READY_MS).toBeLessThanOrEqual(800);
  });
});

/** A browser cache hydrated from a server cache whose queries were dehydrated mid-flight. */
function hydratedWhilePending(keys: string[]) {
  const server = new QueryClient();
  const fetches = new Map(keys.map((key) => [key, deferred<string>()]));
  for (const [key, d] of fetches) {
    void server.prefetchQuery({ queryKey: [key], queryFn: () => d.promise, retry: false });
  }
  const state = dehydrate(server, { shouldDehydrateQuery: () => true });
  const browser = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  hydrate(browser, state);
  return { browser, fetches };
}

describe("sectionWait (what a section suspends on)", () => {
  it("waits for nothing when every query already has data (warm cache)", () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { id: "u1" });
    client.setQueryData(["tasks"], []);
    expect(sectionWait(client, [["me"], ["tasks"]]).pending).toEqual([]);
  });

  it("does not wait for a query nobody streamed (the section's own components fetch it)", () => {
    expect(sectionWait(new QueryClient(), [["never-prefetched"]]).pending).toEqual([]);
  });

  it("waits for each streamed query still in flight, with one stable thenable per fetch", async () => {
    const { browser, fetches } = hydratedWhilePending(["me", "tasks"]);

    const first = sectionWait(browser, [["me"], ["tasks"]]).pending;
    expect(first).toHaveLength(2);
    // A Suspense retry re-runs the gate: `use()` must see the same thenables again.
    const again = sectionWait(browser, [["me"], ["tasks"]]).pending;
    expect(again[0]).toBe(first[0]);
    expect(again[1]).toBe(first[1]);

    fetches.get("me")?.resolve("streamer");
    await first[0];
    // Marked for React, so a re-render after it settled reads it without suspending.
    expect((first[0] as { status?: string }).status).toBe("fulfilled");
    expect(sectionWait(browser, [["me"]]).pending).toEqual([]);
    // The other section is still waiting on its own query, and only on that.
    expect(sectionWait(browser, [["me"], ["tasks"]]).pending).toEqual([first[1]]);
  });

  it("settles (never throws) when a streamed query fails, so the section can show its error", async () => {
    const { browser, fetches } = hydratedWhilePending(["timer"]);
    const { pending } = sectionWait(browser, [["timer"]]);
    expect(pending).toHaveLength(1);

    fetches.get("timer")?.reject(new Error("redacted"));
    await expect(pending[0]).resolves.toBeUndefined();
    expect(browser.getQueryState(["timer"])?.status).toBe("error");
    expect(sectionWait(browser, [["timer"]]).pending).toEqual([]);
  });
});

describe("dashboard wiring", () => {
  const page = read("app/(app)/dashboard/page.tsx");
  const dashboard = read("app/(app)/dashboard/dashboard.tsx");

  it("holds the shell for the streamed batch's deadline, never for the full batch", () => {
    expect(page).toContain("holdShellFor(loadDashboard())");
    expect(page).toContain("await streamDashboard()");
    expect(page).not.toMatch(/await prefetch/);
  });

  it("gives every data-backed section its own boundary and placeholder", () => {
    for (const name of ["status", "timer", "tasks"]) {
      expect(dashboard).toContain(`<SectionPlaceholder name="${name}">`);
    }
    expect(dashboard.match(/<ProgressiveSection\b/g)).toHaveLength(3);
    // No entrance animation on the grid: sections appear in place, they do not rise in.
    expect(dashboard).not.toContain("stagger-reveal");
  });
});
