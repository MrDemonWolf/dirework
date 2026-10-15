import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { API_UNREACHABLE_MESSAGE, describeTrpcError, isServerTrpcError } from "../trpc-errors";

/** What httpBatchLink produces when a procedure returns a tRPC error. */
function serverError(message: string) {
  return TRPCClientError.from({
    error: {
      message,
      code: -32600,
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    },
  });
}

describe("describeTrpcError", () => {
  it("keeps the server's message for a real procedure error", () => {
    const err = serverError("Task text is too long");
    expect(isServerTrpcError(err)).toBe(true);
    expect(describeTrpcError(err)).toBe("Task text is too long");
  });

  it("replaces a JSON-parse failure (HTML outage page / 429 body) with a connection message", () => {
    const err = TRPCClientError.from(
      new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"),
    );
    expect(isServerTrpcError(err)).toBe(false);
    expect(describeTrpcError(err)).toBe(API_UNREACHABLE_MESSAGE);
  });

  it("replaces a network failure with a connection message", () => {
    expect(describeTrpcError(TRPCClientError.from(new TypeError("Failed to fetch")))).toBe(
      API_UNREACHABLE_MESSAGE,
    );
    expect(describeTrpcError(new TypeError("Failed to fetch"))).toBe(API_UNREACHABLE_MESSAGE);
  });

  it("does not promise an automatic retry (mutation toasts share it, and mutations never retry)", () => {
    expect(describeTrpcError(new TypeError("Failed to fetch"))).not.toMatch(/retry|retrying/i);
  });
});
