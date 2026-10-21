import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "session=abc", "cf-connecting-ip": "203.0.113.7" }),
}));

import { trpc } from "@/utils/trpc";

import { prefetchBot, prefetchDashboard, prefetchStyles } from "../server-query";

const originalFetch = globalThis.fetch;

/** Answer every batched call with a payload, in request order. */
function mockBatchFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    const paths = new URL(url).pathname.replace(/^\/trpc\//, "").split(",");
    return Response.json(paths.map((path) => ({ result: { data: { path } } })));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("server prefetches", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_SECRET", "s".repeat(40));
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "http://api.test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("dehydrates the dashboard under the browser proxy's query keys, in one request", async () => {
    const fetchMock = mockBatchFetch();
    const state = await prefetchDashboard();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const keys = state.queries.map((q) => q.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        trpc.user.me.queryKey(),
        trpc.timer.get.queryKey(),
        trpc.config.get.queryKey(),
        trpc.task.list.queryKey(),
      ]),
    );
    expect(keys).toHaveLength(4);
    const me = state.queries.find(
      (q) => JSON.stringify(q.queryKey) === JSON.stringify(trpc.user.me.queryKey()),
    );
    expect(me?.state.data).toEqual({ path: "user.me" });
  });

  it("prefetches config for the Theme Center and config + user for Bot settings", async () => {
    mockBatchFetch();
    const styles = await prefetchStyles();
    expect(styles.queries.map((q) => q.queryKey)).toEqual([trpc.config.get.queryKey()]);

    const bot = await prefetchBot();
    expect(bot.queries.map((q) => q.queryKey)).toEqual(
      expect.arrayContaining([trpc.config.get.queryKey(), trpc.user.me.queryKey()]),
    );
    expect(bot.queries).toHaveLength(2);
  });

  it("degrades to an empty cache (client fetch) when the api is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const state = await prefetchDashboard();
    expect(state.queries).toEqual([]);
  });
});
