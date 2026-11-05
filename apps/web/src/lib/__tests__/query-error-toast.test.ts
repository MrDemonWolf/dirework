import { MutationCache, MutationObserver, QueryCache, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { TRPCClientError } from "@trpc/client";

import { AUTH_LAPSED_MESSAGE, AUTH_LAPSED_TOAST_ID, AuthLapsedError } from "../auth-lapse";
import { toastMutationAuthLapse, toastQueryError } from "../query-error-toast";
import { API_UNREACHABLE_MESSAGE, API_UNREACHABLE_TOAST_ID } from "../trpc-errors";

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: toastQueryError }),
    mutationCache: new MutationCache({ onError: toastMutationAuthLapse }),
    defaultOptions: { queries: { retry: false } },
  });
}

/** What httpBatchLink produces when a procedure answers with a tRPC error. */
function procedureError(message: string, code: string, httpStatus: number) {
  return TRPCClientError.from({ error: { message, code: -32000, data: { code, httpStatus } } });
}

afterEach(() => {
  toastError.mockReset();
  vi.unstubAllGlobals();
});

describe("toastQueryError", () => {
  it("toasts a server tRPC error with its message and a retry action", async () => {
    const client = makeClient();
    const serverError = TRPCClientError.from({
      error: {
        message: "Too many requests",
        code: -32029,
        data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
      },
    });
    await client
      .fetchQuery({ queryKey: ["dashboard"], queryFn: () => Promise.reject(serverError) })
      .catch(() => undefined);

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Too many requests",
      expect.objectContaining({
        id: `query-error:${client.getQueryCache().find({ queryKey: ["dashboard"] })?.queryHash}`,
        action: expect.objectContaining({ label: "retry" }),
      }),
    );
  });

  it("gives each query one toast that a sustained server error keeps replacing", async () => {
    const client = makeClient();
    const outage = procedureError("Internal server error", "INTERNAL_SERVER_ERROR", 500);
    const fail = (queryKey: string[]) =>
      client
        .fetchQuery({ queryKey, queryFn: () => Promise.reject(outage), staleTime: 0 })
        .catch(() => undefined);

    await fail(["timer"]);
    await fail(["timer"]);
    await fail(["tasks"]);

    const ids = toastError.mock.calls.map(([, options]) => options?.id);
    expect(ids).toHaveLength(3);
    // The timer's two failures share one sonner id (the second updates the first toast);
    // the task list gets its own.
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("answers a lapsed sign-in with the one reload toast, never the refusal itself", async () => {
    const client = makeClient();
    const refusals = [
      procedureError("Authentication required", "UNAUTHORIZED", 401),
      procedureError("Owner access required", "FORBIDDEN", 403),
      TRPCClientError.from(new AuthLapsedError()),
    ];
    for (const [index, refusal] of refusals.entries()) {
      await client
        .fetchQuery({ queryKey: ["dashboard", index], queryFn: () => Promise.reject(refusal) })
        .catch(() => undefined);
    }

    expect(toastError).toHaveBeenCalledTimes(3);
    for (const [message, options] of toastError.mock.calls) {
      expect(message).toBe(AUTH_LAPSED_MESSAGE);
      expect(options).toMatchObject({
        id: AUTH_LAPSED_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: { label: "Reload" },
      });
    }
  });

  it("reloads the page from the lapse toast", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    await makeClient()
      .fetchQuery({
        queryKey: ["dashboard"],
        queryFn: () => Promise.reject(procedureError("No session", "UNAUTHORIZED", 401)),
      })
      .catch(() => undefined);

    const [, options] = toastError.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("collapses transport failures into one stable unreachable toast", async () => {
    const client = makeClient();
    await client
      .fetchQuery({
        queryKey: ["dashboard"],
        queryFn: () => Promise.reject(new Error("Unexpected token '<'")),
      })
      .catch(() => undefined);

    expect(toastError).toHaveBeenCalledWith(
      API_UNREACHABLE_MESSAGE,
      expect.objectContaining({ id: API_UNREACHABLE_TOAST_ID }),
    );
  });

  it("stays silent for queries marked meta.silent (overlay polling)", async () => {
    const client = makeClient();
    await client
      .fetchQuery({
        queryKey: ["overlay"],
        queryFn: () => Promise.reject(new Error("Failed to fetch")),
        meta: { silent: true },
      })
      .catch(() => undefined);

    expect(toastError).not.toHaveBeenCalled();
  });

  it("keeps the last good payload when a silent refetch fails", async () => {
    const client = makeClient();
    const key = ["overlay", "timer"];
    let fail = false;
    const queryFn = () => (fail ? Promise.reject(new Error("down")) : Promise.resolve("payload"));

    await client.fetchQuery({ queryKey: key, queryFn, meta: { silent: true } });
    fail = true;
    await client
      .fetchQuery({ queryKey: key, queryFn, meta: { silent: true }, staleTime: 0 })
      .catch(() => undefined);

    expect(client.getQueryData(key)).toBe("payload");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("retry refetches the failed query immediately", async () => {
    const client = makeClient();
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce("recovered");
    await client.fetchQuery({ queryKey: ["dashboard"], queryFn }).catch(() => undefined);

    const [, options] = toastError.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();

    await vi.waitFor(() => expect(client.getQueryData(["dashboard"])).toBe("recovered"));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

describe("toastMutationAuthLapse", () => {
  const mutate = (error: Error) =>
    new MutationObserver(makeClient(), { mutationFn: () => Promise.reject(error) })
      .mutate()
      .catch(() => undefined);

  it("raises the reload toast for a write refused because the sign-in lapsed", async () => {
    await mutate(procedureError("Authentication required", "UNAUTHORIZED", 401));
    expect(toastError).toHaveBeenCalledWith(
      AUTH_LAPSED_MESSAGE,
      expect.objectContaining({ id: AUTH_LAPSED_TOAST_ID }),
    );
  });

  it("leaves every other failed write to the mutation's own onError", async () => {
    await mutate(procedureError("Task text is too long", "BAD_REQUEST", 400));
    await mutate(new TypeError("Failed to fetch"));
    expect(toastError).not.toHaveBeenCalled();
  });
});
