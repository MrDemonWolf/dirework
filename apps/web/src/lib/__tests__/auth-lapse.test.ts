import {
  createTRPCUntypedClient,
  httpBatchLink,
  TRPCClientError,
  type TRPCLink,
} from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthLapsedError,
  fetchRpc,
  isAuthLapseError,
  isClientError,
  shouldRetryQuery,
} from "../auth-lapse";

afterEach(() => {
  vi.unstubAllGlobals();
});

type ErrorCode = keyof typeof TRPC_ERROR_CODES_BY_KEY;

/** A batch answer carrying one procedure error, as the api worker (via the web proxy) sends it. */
function procedureAnswer(code: ErrorCode, httpStatus: number): Response {
  const body = [
    {
      error: {
        message: code,
        code: TRPC_ERROR_CODES_BY_KEY[code],
        data: { code, httpStatus, path: "timer.get" },
      },
    },
  ];
  return Response.json(body, { status: httpStatus });
}

/** The error a real client's query rejects with when the network gives `answer`. */
async function errorFrom(answer: () => Promise<Response>): Promise<unknown> {
  const client = createTRPCUntypedClient<AnyRouter>({
    links: [httpBatchLink({ url: "http://web.test/rpc", fetch: answer })],
  });
  return client.query("timer.get").then(
    () => {
      throw new Error("expected the query to fail");
    },
    (err: unknown) => err,
  );
}

const refusal = (code: ErrorCode, status: number) =>
  errorFrom(async () => procedureAnswer(code, status));
const networkFailure = () =>
  errorFrom(async () => {
    throw new TypeError("Failed to fetch");
  });

describe("isAuthLapseError", () => {
  it("is a procedure refusing the session (UNAUTHORIZED) or the owner check (FORBIDDEN)", async () => {
    expect(isAuthLapseError(await refusal("UNAUTHORIZED", 401))).toBe(true);
    expect(isAuthLapseError(await refusal("FORBIDDEN", 403))).toBe(true);
  });

  it("is a sign-in wall met by the /rpc fetch, bare or as the client error's cause", async () => {
    expect(isAuthLapseError(new AuthLapsedError())).toBe(true);
    const walled = await errorFrom(() => Promise.reject(new AuthLapsedError()));
    expect(isAuthLapseError(walled)).toBe(true);
  });

  it("is nothing else", async () => {
    expect(isAuthLapseError(await refusal("BAD_REQUEST", 400))).toBe(false);
    expect(isAuthLapseError(await refusal("NOT_FOUND", 404))).toBe(false);
    expect(isAuthLapseError(await refusal("INTERNAL_SERVER_ERROR", 500))).toBe(false);
    expect(isAuthLapseError(await networkFailure())).toBe(false);
    expect(isAuthLapseError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isAuthLapseError(null)).toBe(false);
  });
});

describe("shouldRetryQuery", () => {
  // `failureCount` is how many attempts have failed before this decision, minus one: React
  // Query asks with 0 after the first failure, so `true` at 0 and 1 means two retries.
  const retries = (err: unknown) => [0, 1, 2].filter((count) => shouldRetryQuery(count, err));

  it("retries a network failure or a server error twice", async () => {
    expect(retries(await networkFailure())).toEqual([0, 1]);
    expect(retries(new TypeError("Failed to fetch"))).toEqual([0, 1]);
    expect(retries(await refusal("INTERNAL_SERVER_ERROR", 500))).toEqual([0, 1]);
    const outagePage = await errorFrom(
      async () => new Response("<html>502</html>", { status: 502 }),
    );
    expect(retries(outagePage)).toEqual([0, 1]);
  });

  it("never retries a 4xx answer: the same request would be refused again", async () => {
    for (const [code, status] of [
      ["BAD_REQUEST", 400],
      ["UNAUTHORIZED", 401],
      ["FORBIDDEN", 403],
      ["NOT_FOUND", 404],
      ["CONFLICT", 409],
      ["PRECONDITION_FAILED", 412],
      ["TOO_MANY_REQUESTS", 429],
    ] as const) {
      const err = await refusal(code, status);
      expect(isClientError(err), code).toBe(true);
      expect(retries(err), code).toEqual([]);
    }
  });

  it("never retries the rate limiter's own 429 (JSON, but not a tRPC error)", async () => {
    const limited = await errorFrom(async () =>
      Response.json({ error: "Too many requests" }, { status: 429 }),
    );
    expect(isClientError(limited)).toBe(true);
    expect(retries(limited)).toEqual([]);
  });

  it("never retries a lapsed sign-in", async () => {
    const walled = await errorFrom(() => Promise.reject(new AuthLapsedError()));
    expect(retries(walled)).toEqual([]);
  });
});

describe("fetchRpc", () => {
  it("sends the session cookie, a time box, and never follows a redirect", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json([{ result: { data: 1 } }]),
    );
    vi.stubGlobal("fetch", fetch);
    const caller = new AbortController();

    await fetchRpc("/rpc/timer.get", { method: "GET", signal: caller.signal });

    const [input, init] = fetch.mock.calls[0] ?? [];
    expect(input).toBe("/rpc/timer.get");
    expect(init).toMatchObject({ method: "GET", credentials: "include", redirect: "manual" });
    // The caller's signal still cancels the request (React Query aborts unused fetches).
    expect(init?.signal?.aborted).toBe(false);
    caller.abort();
    expect(init?.signal?.aborted).toBe(true);
  });

  it("reports a redirect as a lapsed sign-in instead of handing tRPC an empty body", async () => {
    // A browser hands a redirect it was told not to follow back as an opaque one: status 0,
    // no body, no Location. Other runtimes return the 3xx itself.
    const opaque = { type: "opaqueredirect", status: 0, ok: false } as unknown as Response;
    vi.stubGlobal("fetch", async () => opaque);
    await expect(fetchRpc("/rpc/timer.get")).rejects.toBeInstanceOf(AuthLapsedError);

    const found = new Response(null, {
      status: 302,
      headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/x" },
    });
    vi.stubGlobal("fetch", async () => found);
    await expect(fetchRpc("/rpc/timer.get")).rejects.toBeInstanceOf(AuthLapsedError);
  });

  it("hands every other answer to tRPC as it came, refusals included", async () => {
    for (const status of [200, 207, 401, 403, 429, 500, 502]) {
      const answer = new Response("{}", { status });
      vi.stubGlobal("fetch", async () => answer);
      await expect(fetchRpc("/rpc/timer.get")).resolves.toBe(answer);
    }
  });
});

/** The app modules with page-level state, freshly loaded as on a new page. */
async function freshPage(options: { browser: boolean } = { browser: true }) {
  vi.resetModules();
  if (options.browser) vi.stubGlobal("window", new EventTarget());
  return {
    lapse: await import("../auth-lapse"),
    polls: await import("../poll-intervals"),
  };
}

describe("the lapse flag", () => {
  it("stops every dashboard poll for the rest of the page's life", async () => {
    const { lapse, polls } = await freshPage();
    const timer = polls.DASHBOARD_TIMER_QUERY_OPTS.refetchInterval;
    const tasks = polls.dashboardPollInterval(polls.DASHBOARD_TASKS_POLL_MS);
    expect(timer()).toBe(polls.DASHBOARD_TIMER_POLL_MS);
    expect(tasks()).toBe(polls.DASHBOARD_TASKS_POLL_MS);

    lapse.markAuthLapsed();

    expect(lapse.isAuthLapsed()).toBe(true);
    expect(timer()).toBe(false);
    expect(tasks()).toBe(false);
    expect(polls.dashboardPollInterval(polls.DASHBOARD_TASKS_POLL_MS)()).toBe(false);
  });

  it("is never set on the server, where one isolate serves many requests", async () => {
    const { lapse, polls } = await freshPage({ browser: false });
    lapse.markAuthLapsed();
    expect(lapse.isAuthLapsed()).toBe(false);
    expect(polls.dashboardPollInterval(polls.DASHBOARD_TASKS_POLL_MS)()).toBe(
      polls.DASHBOARD_TASKS_POLL_MS,
    );
  });
});

describe("authLapseLink", () => {
  /** A client whose network answers `answer()` and counts what reached it. */
  async function clientOver(answer: () => "ok" | "unauthorized" | "server-error") {
    const { lapse } = await freshPage();
    const reached: string[] = [];
    const network: TRPCLink<AnyRouter> =
      () =>
      ({ op }) =>
        observable((observer) => {
          reached.push(`${op.type} ${op.path}`);
          const kind = answer();
          if (kind === "ok") {
            observer.next({ result: { type: "data", data: op.path } });
            observer.complete();
            return;
          }
          // What httpBatchLink hands on: the procedure's error, read from the batch answer.
          const code = kind === "unauthorized" ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR";
          const httpStatus = kind === "unauthorized" ? 401 : 500;
          observer.error(
            TRPCClientError.from({
              error: {
                message: code,
                code: TRPC_ERROR_CODES_BY_KEY[code],
                data: { code, httpStatus },
              },
            }),
          );
        });
    const client = createTRPCUntypedClient<AnyRouter>({ links: [lapse.authLapseLink(), network] });
    return { lapse, client, reached };
  }

  it("marks the lapse before the caller hears of the refusal", async () => {
    const { lapse, client } = await clientOver(() => "unauthorized");
    const seenByCaller = await client.query("timer.get").then(
      () => null,
      () => lapse.isAuthLapsed(),
    );
    expect(seenByCaller).toBe(true);
  });

  it("leaves a server error alone", async () => {
    const { lapse, client } = await clientOver(() => "server-error");
    await client.query("timer.get").catch(() => undefined);
    expect(lapse.isAuthLapsed()).toBe(false);
  });

  it("then answers reads itself, with no request, and still sends writes", async () => {
    let answer: "ok" | "unauthorized" = "unauthorized";
    const { lapse, client, reached } = await clientOver(() => answer);
    await client.query("timer.get").catch(() => undefined);
    answer = "ok";

    const read = await client.query("task.list").catch((err: unknown) => err);
    expect(lapse.isAuthLapseError(read)).toBe(true);
    await expect(client.mutation("task.create", { text: "kept" })).resolves.toBe("task.create");

    expect(reached).toEqual(["query timer.get", "mutation task.create"]);
  });
});
