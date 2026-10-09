import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trpcErrorReporter } from "../trpc-error";

function makeCtx(url = "https://api.test/trpc/task.create?batch=1") {
  const store: Record<string, unknown> = { requestId: "req-123" };
  return { get: (key: string) => store[key], req: { url } };
}

function capture() {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return {
    metrics: () => log.mock.calls.map((call) => JSON.parse(String(call[0]))),
    errors: () => error.mock.calls.map((call) => JSON.parse(String(call[0]))),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trpcErrorReporter", () => {
  it("records internal errors with request id, procedure path, and the cause's name", () => {
    const out = capture();
    const cause = new Error("D1_ERROR: INSERT INTO task (text) VALUES ('secret task')");
    cause.name = "D1Error";

    trpcErrorReporter(makeCtx())({
      error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause }),
      path: "task.create",
    });

    expect(out.metrics()).toEqual([
      {
        type: "metric",
        metric: "internal.error",
        requestId: "req-123",
        label: "INTERNAL_SERVER_ERROR",
        count: 1,
      },
    ]);
    expect(out.errors()).toEqual([
      {
        type: "error",
        requestId: "req-123",
        path: "/trpc/task.create",
        name: "D1Error",
        reason: "task.create",
      },
    ]);
    expect(JSON.stringify(out.errors())).not.toContain("secret task");
  });

  it("still correlates when there is no procedure path (createContext failure)", () => {
    const out = capture();

    trpcErrorReporter(makeCtx())({
      error: new TRPCError({ code: "INTERNAL_SERVER_ERROR" }),
    });

    expect(out.errors()[0]).toMatchObject({
      requestId: "req-123",
      name: "TRPCError",
      reason: "INTERNAL_SERVER_ERROR",
    });
  });

  it("ignores expected client errors", () => {
    const out = capture();

    trpcErrorReporter(makeCtx())({
      error: new TRPCError({ code: "UNAUTHORIZED" }),
      path: "task.create",
    });

    expect(out.metrics()).toEqual([]);
    expect(out.errors()).toEqual([]);
  });
});
