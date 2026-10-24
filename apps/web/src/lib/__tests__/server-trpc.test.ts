import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      cookie: "__Secure-better-auth.session_token=abc",
      "cf-connecting-ip": "203.0.113.7",
      // A client-supplied copy must never be forwarded as-is.
      "x-dirework-client-ip": "198.51.100.66",
    }),
}));

import { QueryClient } from "@tanstack/react-query";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  verifyClientIp,
} from "@dirework/api/proxy-identity";

import { createServerTrpc } from "../server-trpc";

const SECRET = "s".repeat(40);
const originalFetch = globalThis.fetch;

/** The api's answer, from the real tRPC fetch adapter (JSON lines, since the link streams). */
const api = initTRPC.create();
const apiRouter = api.router({
  user: api.router({ me: api.procedure.query(() => null) }),
  task: api.router({ list: api.procedure.query(() => null) }),
  config: api.router({ get: api.procedure.query(() => null) }),
});
function batchResponse(url: string, init?: RequestInit): Promise<Response> {
  return fetchRequestHandler({ endpoint: "/trpc", req: new Request(url, init), router: apiRouter });
}

describe("createServerTrpc", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "http://api.test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("batches same-tick prefetches into ONE direct GET to the api worker's /trpc", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => batchResponse(url, init));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const queryClient = new QueryClient();
    const t = createServerTrpc(queryClient);
    await Promise.all([
      queryClient.prefetchQuery(t.user.me.queryOptions()),
      queryClient.prefetchQuery(t.task.list.queryOptions()),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url).startsWith("http://api.test/trpc/user.me,task.list?batch=1")).toBe(true);
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // Streamed: each procedure resolves as the api writes it (lib/progressive.ts).
    expect(new Headers(init?.headers).get("trpc-accept")).toBe("application/jsonl");
  });

  it("forwards the cookie and the signed browser IP, never a client-supplied IP header", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => batchResponse(url, init));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const queryClient = new QueryClient();
    const t = createServerTrpc(queryClient);
    await queryClient.prefetchQuery(t.config.get.queryOptions());

    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(sent.get("cookie")).toBe("__Secure-better-auth.session_token=abc");
    expect(sent.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(
      await verifyClientIp("203.0.113.7", sent.get(CLIENT_IP_SIGNATURE_HEADER) ?? "", SECRET),
    ).toBe(true);
  });
});
