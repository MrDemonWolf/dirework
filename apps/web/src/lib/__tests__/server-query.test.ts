import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "session=abc", "cf-connecting-ip": "203.0.113.7" }),
}));

import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { SECTIONS_READY_MS } from "@/lib/progressive";
import { trpc } from "@/utils/trpc";

import { prefetchStyles, streamBot, streamDashboard } from "../server-query";

const originalFetch = globalThis.fetch;

/**
 * A stand-in api worker: the real tRPC fetch adapter over a router with the dashboard's
 * paths, so the batch link gets exactly what production answers (a JSON array, or JSON lines
 * when the client streams). `delays` holds a procedure back; `failing` makes one throw.
 */
function serveApi({
  delays = {},
  failing = [],
}: {
  delays?: Record<string, number>;
  failing?: string[];
} = {}) {
  const t = initTRPC.create();
  const proc = (path: string) =>
    t.procedure.query(async () => {
      if (delays[path]) await new Promise((r) => setTimeout(r, delays[path]));
      if (failing.includes(path)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { path };
    });
  const router = t.router({
    user: t.router({ me: proc("user.me") }),
    timer: t.router({ get: proc("timer.get") }),
    config: t.router({ get: proc("config.get") }),
    task: t.router({ list: proc("task.list") }),
  });
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) =>
    fetchRequestHandler({ endpoint: "/trpc", req: new Request(url, init), router }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const keyOf = (q: { queryKey: unknown }) => JSON.stringify(q.queryKey);

describe("streamDashboard", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_SECRET", "s".repeat(40));
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "http://api.test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  const DASHBOARD_KEYS = () =>
    [
      trpc.user.me.queryKey(),
      trpc.timer.get.queryKey(),
      trpc.config.get.queryKey(),
      trpc.task.list.queryKey(),
    ]
      .map((queryKey) => keyOf({ queryKey }))
      .sort();
  const find = (state: Awaited<ReturnType<typeof streamDashboard>>, queryKey: unknown) =>
    state.queries.find((query) => keyOf(query) === keyOf({ queryKey }));

  it("fast api: dehydrates all four as data, under the browser proxy's keys, in ONE streamed GET", async () => {
    const fetchMock = serveApi();
    const state = await streamDashboard();

    expect(state.queries.map(keyOf).sort()).toEqual(DASHBOARD_KEYS());
    for (const query of state.queries) {
      expect(query.state.status).toBe("success");
      expect(query.promise).toBeUndefined();
    }
    expect(find(state, trpc.user.me.queryKey())?.state.data).toEqual({ path: "user.me" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/trpc/user.me,timer.get,config.get,task.list?batch=1");
    expect(new Headers(init?.headers).get("trpc-accept")).toBe("application/jsonl");
  });

  it("slow procedure: returns at the deadline with the rest as data and that one still streaming", async () => {
    const fetchMock = serveApi({ delays: { "task.list": SECTIONS_READY_MS + 450 } });
    const started = Date.now();
    const state = await streamDashboard();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(SECTIONS_READY_MS - 10);
    expect(elapsed).toBeLessThan(SECTIONS_READY_MS + 350);
    expect(state.queries.map(keyOf).sort()).toEqual(DASHBOARD_KEYS());
    expect(find(state, trpc.user.me.queryKey())?.state.status).toBe("success");
    expect(find(state, trpc.timer.get.queryKey())?.state.status).toBe("success");
    expect(find(state, trpc.config.get.queryKey())?.state.status).toBe("success");

    const tasks = find(state, trpc.task.list.queryKey());
    expect(tasks?.state.status).toBe("pending");
    await expect(tasks?.promise).resolves.toEqual({ path: "task.list" });
    // The late result rode the same request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a procedure that fails after the deadline rejects only its own streamed promise", async () => {
    serveApi({ delays: { "timer.get": SECTIONS_READY_MS + 250 }, failing: ["timer.get"] });
    const state = await streamDashboard();
    expect(find(state, trpc.user.me.queryKey())?.state.status).toBe("success");
    const timer = find(state, trpc.timer.get.queryKey());
    expect(timer?.state.status).toBe("pending");
    await expect(timer?.promise).rejects.toThrow();
  });

  it("a procedure that already failed is left out, so the client refetches it", async () => {
    serveApi({ failing: ["timer.get"] });
    const state = await streamDashboard();
    expect(find(state, trpc.timer.get.queryKey())).toBeUndefined();
    expect(state.queries).toHaveLength(3);
  });

  it("never throws when the api is unreachable: an empty cache, at once", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const started = Date.now();
    const state = await streamDashboard();
    expect(state.queries).toEqual([]);
    expect(Date.now() - started).toBeLessThan(SECTIONS_READY_MS);
  });
});

describe("awaited prefetches", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_SECRET", "s".repeat(40));
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "http://api.test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("prefetches config for the Theme Center", async () => {
    const fetchMock = serveApi();
    const styles = await prefetchStyles();
    expect(styles.queries.map((q) => q.queryKey)).toEqual([trpc.config.get.queryKey()]);
    expect(styles.queries[0]?.state.data).toEqual({ path: "config.get" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to an empty cache (client fetch) when the api is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const state = await prefetchStyles();
    expect(state.queries).toEqual([]);
  });
});

describe("streamBot", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_SECRET", "s".repeat(40));
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "http://api.test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  const find = (state: Awaited<ReturnType<typeof streamBot>>, queryKey: unknown) =>
    state.queries.find((query) => keyOf(query) === keyOf({ queryKey }));

  it("fast api: config + user as data, in the same ONE streamed GET as before", async () => {
    const fetchMock = serveApi();
    const state = await streamBot();

    expect(state.queries.map(keyOf).sort()).toEqual(
      [trpc.config.get.queryKey(), trpc.user.me.queryKey()]
        .map((queryKey) => keyOf({ queryKey }))
        .sort(),
    );
    for (const query of state.queries) expect(query.state.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/trpc/config.get,user.me?batch=1");
    expect(new Headers(init?.headers).get("trpc-accept")).toBe("application/jsonl");
  });

  it("slow user.me: returns at the deadline with config as data and user still streaming", async () => {
    const fetchMock = serveApi({ delays: { "user.me": SECTIONS_READY_MS + 450 } });
    const started = Date.now();
    const state = await streamBot();

    expect(Date.now() - started).toBeLessThan(SECTIONS_READY_MS + 350);
    expect(find(state, trpc.config.get.queryKey())?.state.status).toBe("success");
    const user = find(state, trpc.user.me.queryKey());
    expect(user?.state.status).toBe("pending");
    await expect(user?.promise).resolves.toEqual({ path: "user.me" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when the api is unreachable: an empty cache (client fetch)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const state = await streamBot();
    expect(state.queries).toEqual([]);
  });
});
