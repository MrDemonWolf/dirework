import { afterEach, describe, expect, it, vi } from "vitest";

import { anySignal, TRPC_REQUEST_TIMEOUT_MS, withRequestTimeout } from "../fetch-timeout";
import { createSerialQueue } from "../serial-queue";

/** A fetch that never answers unless its signal aborts — a hung api worker. */
function hungFetch(_url: string, init?: { signal?: AbortSignal | null }): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    signal.addEventListener("abort", () => reject(signal.reason));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withRequestTimeout", () => {
  it("defaults to a 30s budget", () => {
    expect(TRPC_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it("aborts a hung request after the timeout with a TimeoutError", async () => {
    const pending = hungFetch("/trpc/bot.ingest", { signal: withRequestTimeout(undefined, 20) });
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("still honors tRPC's own cancellation signal", async () => {
    const caller = new AbortController();
    const signal = withRequestTimeout(caller.signal, 60_000);
    caller.abort(new Error("cancelled"));
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error).message).toBe("cancelled");
  });

  it("lets the serial ingest queue move on after a timed-out call", async () => {
    const run = createSerialQueue();
    const first = run(() =>
      hungFetch("/trpc/bot.ingest", { signal: withRequestTimeout(null, 20) }),
    );
    const second = run(async () => "next command");

    await expect(first).rejects.toMatchObject({ name: "TimeoutError" });
    await expect(second).resolves.toBe("next command");
  });
});

describe("anySignal fallback (no AbortSignal.any)", () => {
  it("aborts with the first input's reason and works when one is already aborted", () => {
    vi.stubGlobal(
      "AbortSignal",
      Object.assign(Object.create(AbortSignal), {
        any: undefined,
        timeout: AbortSignal.timeout.bind(AbortSignal),
      }),
    );
    const a = new AbortController();
    const b = new AbortController();
    const combined = anySignal([a.signal, b.signal]);
    expect(combined.aborted).toBe(false);
    b.abort("b-reason");
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe("b-reason");

    const done = new AbortController();
    done.abort("early");
    const already = anySignal([new AbortController().signal, done.signal]);
    expect(already.reason).toBe("early");
  });

  it("falls back to a timer when AbortSignal.timeout is missing", async () => {
    vi.stubGlobal(
      "AbortSignal",
      Object.assign(Object.create(AbortSignal), { any: undefined, timeout: undefined }),
    );
    const signal = withRequestTimeout(undefined, 10);
    await new Promise((r) => setTimeout(r, 30));
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });
});
