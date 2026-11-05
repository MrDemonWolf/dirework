// The dashboard's tRPC client (utils/trpc.ts) when the owner's sign-in lapses: the session
// ended elsewhere (the api answers UNAUTHORIZED) or an edge sign-in wall in front of /rpc
// (Cloudflare Access) answered with a redirect to its login page. Drives the real client,
// links and QueryClient the way the dashboard polls them, over a stubbed `fetch`, so every
// count below is a request that would have reached the web worker.

import { MutationObserver, QueryObserver } from "@tanstack/react-query";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React Query decides browser or server once, as it loads (`typeof window`), and utils/trpc.ts
// reads that answer: give this file a browser `window` before anything imports them. (The
// server's client is covered in server-query.test.ts.)
vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", { value: new EventTarget(), configurable: true });
});

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError }, Toaster: () => null }));

type Answer = "ok" | "unauthorized" | "server-error" | "offline" | "access-redirect";

/** A tRPC error entry, as the api worker writes it into a batch response. */
function procedureError(path: string, code: "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR") {
  const httpStatus = code === "UNAUTHORIZED" ? 401 : 500;
  const message = code === "UNAUTHORIZED" ? "Authentication required" : "Internal server error";
  return {
    error: { message, code: TRPC_ERROR_CODES_BY_KEY[code], data: { code, httpStatus, path } },
  };
}

/**
 * Stand-in for the network behind `/rpc`: answers every batched request the way the web proxy
 * relays the api worker (or the way a browser reports a redirect it was told not to follow),
 * and records what the client sent.
 */
function stubNetwork() {
  const sent: { url: string; init: RequestInit | undefined; answer: Answer }[] = [];
  let answer: Answer = "ok";
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const kind = answer;
    sent.push({ url, init, answer: kind });
    if (kind === "offline") throw new TypeError("Failed to fetch");
    if (kind === "access-redirect") {
      // With `redirect: "manual"` the browser hands back an opaque redirect (status 0, no
      // body). Followed instead, the cross-origin login page fails CORS: a network error.
      if (init?.redirect !== "manual") throw new TypeError("Failed to fetch");
      return {
        type: "opaqueredirect",
        status: 0,
        ok: false,
        headers: new Headers(),
        json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
      } as unknown as Response;
    }
    const paths = new URL(url, "http://web.test").pathname.replace(/^\/rpc\//, "").split(",");
    const body = paths.map((path) => {
      if (kind === "unauthorized") return procedureError(path, "UNAUTHORIZED");
      if (kind === "server-error") return procedureError(path, "INTERNAL_SERVER_ERROR");
      return { result: { data: { path } } };
    });
    const status = { ok: 200, unauthorized: 401, "server-error": 500 }[kind];
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return {
    fetch,
    sent,
    answerWith(next: Answer) {
      answer = next;
    },
    /** Requests that went out while the network was answering `kind`. */
    count(kind: Answer) {
      return sent.filter((request) => request.answer === kind).length;
    },
  };
}

/**
 * utils/trpc.ts as a fresh dashboard load gets it: every app module evaluates anew, so the
 * browser QueryClient and any page-level state start from nothing, and the (app) layout's
 * AppToaster registers the toasts (lib/query-error-reporter.ts) as its module loads.
 */
async function loadBrowserClient() {
  vi.resetModules();
  await import("@/components/app-toaster");
  const { trpc } = await import("@/utils/trpc");
  const { getQueryClient } = await import("@/utils/query-client");
  const polls = await import("@/lib/poll-intervals");
  return { queryClient: getQueryClient(), trpc, polls };
}

let network: ReturnType<typeof stubNetwork>;

beforeEach(() => {
  vi.useFakeTimers();
  network = stubNetwork();
  vi.stubGlobal("fetch", network.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  toastError.mockReset();
});

/** Subscribe the dashboard's two polls (timer console and task board) as their components do. */
async function openDashboard() {
  const client = await loadBrowserClient();
  const { queryClient, trpc, polls } = client;
  const observers = [
    new QueryObserver(queryClient, {
      ...trpc.timer.get.queryOptions(),
      ...polls.DASHBOARD_TIMER_QUERY_OPTS,
    }),
    new QueryObserver(queryClient, {
      ...trpc.task.list.queryOptions(),
      refetchInterval: polls.dashboardPollInterval(polls.DASHBOARD_TASKS_POLL_MS),
    }),
  ];
  const unsubscribe = observers.map((observer) => observer.subscribe(() => {}));
  // A few healthy cycles of both polls.
  await vi.advanceTimersByTimeAsync(6_000);
  expect(network.count("ok")).toBeGreaterThanOrEqual(4);
  return {
    ...client,
    close() {
      for (const stop of unsubscribe) stop();
    },
  };
}

/** The toasts raised so far, as "message #id". */
function toasts(): Set<string> {
  return new Set(toastError.mock.calls.map(([message, options]) => `${message} #${options?.id}`));
}

describe("a lapsed sign-in on an open dashboard", () => {
  it("is refused once, then both polls stop and one toast stays up with a Reload", async () => {
    const dashboard = await openDashboard();

    network.answerWith("unauthorized");
    // The next poll is refused, then an hour passes with the dashboard left open.
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    dashboard.close();

    // Only the poll that found out went out: no retry of it, no later poll of either query.
    expect(network.count("unauthorized")).toBe(1);
    // Every refusal raised the same toast, which stays until the owner acts on it.
    expect(toasts()).toEqual(new Set(["Your sign-in expired #auth-lapsed"]));
    expect(toastError.mock.calls[0]?.[1]).toMatchObject({
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Reload" },
    });
  });

  it("reads an edge sign-in wall's redirect as a lapse, not as a connection failure", async () => {
    const dashboard = await openDashboard();

    network.answerWith("access-redirect");
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    dashboard.close();

    // The /rpc fetch never follows a redirect, so the login page's origin is never contacted.
    expect(network.sent.every((request) => request.init?.redirect === "manual")).toBe(true);
    expect(network.count("access-redirect")).toBe(1);
    expect(toasts()).toEqual(new Set(["Your sign-in expired #auth-lapsed"]));
  });

  it("still sends a write, so a draft can be saved after signing in again elsewhere", async () => {
    const dashboard = await openDashboard();
    network.answerWith("unauthorized");
    await vi.advanceTimersByTimeAsync(5_000);
    dashboard.close();
    expect(network.count("unauthorized")).toBe(1);

    // Signed in again in another tab: the cookie is back, and the save goes out and lands.
    network.answerWith("ok");
    const save = new MutationObserver(
      dashboard.queryClient,
      dashboard.trpc.task.create.mutationOptions(),
    ).mutate({ text: "kept draft" });
    await vi.advanceTimersByTimeAsync(0);
    await expect(save).resolves.toEqual({ path: "task.create" });
    expect(network.sent.at(-1)?.url).toContain("/rpc/task.create");
  });
});

describe("query retries in the browser", () => {
  /** Subscribe one query with no poll, let it fail for a minute, and count what went out. */
  async function failOnce(answer: Answer): Promise<number> {
    const { queryClient, trpc } = await loadBrowserClient();
    network.answerWith(answer);
    const stop = new QueryObserver(queryClient, trpc.config.get.queryOptions()).subscribe(() => {});
    await vi.advanceTimersByTimeAsync(60_000);
    stop();
    return network.count(answer);
  }

  it("never retries a refused (4xx) query", async () => {
    expect(await failOnce("unauthorized")).toBe(1);
  });

  it("retries a server error or a network failure twice, not three times", async () => {
    expect(await failOnce("server-error")).toBe(3);
    expect(await failOnce("offline")).toBe(3);
  });
});
