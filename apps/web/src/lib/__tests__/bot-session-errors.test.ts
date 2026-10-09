import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { BOT_REAUTH_REQUIRED_MESSAGE } from "@dirework/api/config-shared";

import { classifyBotError } from "../bot-session-errors";

function trpcError(code: string, message = "boom") {
  return TRPCClientError.from({
    error: { code: -32_000, message, data: { code, httpStatus: 400 } },
  });
}

describe("classifyBotError", () => {
  it("treats UNAUTHORIZED as a revoked bot link", () => {
    expect(classifyBotError(trpcError("UNAUTHORIZED"))).toBe("revoked");
  });

  it("treats BAD_REQUEST (a malformed bot link) as a permanent invalid link", () => {
    expect(classifyBotError(trpcError("BAD_REQUEST"))).toBe("invalid-link");
  });

  it("treats a failed bot token refresh as a bot account that must be reconnected", () => {
    expect(classifyBotError(trpcError("PRECONDITION_FAILED", BOT_REAUTH_REQUIRED_MESSAGE))).toBe(
      "reauth",
    );
  });

  it("retries other PRECONDITION_FAILED errors such as a missing channel login", () => {
    expect(
      classifyBotError(trpcError("PRECONDITION_FAILED", "Owner Twitch login unavailable")),
    ).toBe("transient");
  });

  it("treats NOT_FOUND as no bot account connected", () => {
    expect(classifyBotError(trpcError("NOT_FOUND"))).toBe("no-account");
  });

  it("treats Twitch/D1 outages and network errors as transient", () => {
    expect(classifyBotError(trpcError("SERVICE_UNAVAILABLE"))).toBe("transient");
    expect(classifyBotError(trpcError("INTERNAL_SERVER_ERROR"))).toBe("transient");
    expect(classifyBotError(new TypeError("Failed to fetch"))).toBe("transient");
    expect(classifyBotError(undefined)).toBe("transient");
    expect(classifyBotError({ data: { code: 401 } })).toBe("transient");
  });

  it("only treats the exact reauth message as reauth, whatever the error class", () => {
    const plain = Object.assign(new Error(BOT_REAUTH_REQUIRED_MESSAGE), {
      data: { code: "PRECONDITION_FAILED" },
    });
    expect(classifyBotError(plain)).toBe("reauth");
  });
});
