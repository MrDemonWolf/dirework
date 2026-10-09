import { QueryCache, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { TRPCClientError } from "@trpc/client";

import { toastQueryError } from "../query-error-toast";
import { API_UNREACHABLE_MESSAGE, API_UNREACHABLE_TOAST_ID } from "../trpc-errors";

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: toastQueryError }),
    defaultOptions: { queries: { retry: false } },
  });
}

afterEach(() => {
  toastError.mockReset();
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
        id: undefined,
        action: expect.objectContaining({ label: "retry" }),
      }),
    );
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
});
