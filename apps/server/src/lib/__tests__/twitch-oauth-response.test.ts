import { describe, expect, it } from "vitest";

import {
  isTimeoutError,
  parseBotOAuthState,
  parseOAuthCallbackParams,
  parseTwitchHelixUser,
  parseTwitchTokenResponse,
} from "../twitch-oauth-response";

describe("parseTwitchTokenResponse", () => {
  it("keeps only a valid bounded token response", () => {
    expect(
      parseTwitchTokenResponse({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer",
        scope: ["chat:read", "chat:edit"],
        attackerControlled: "discarded",
      }),
    ).toEqual({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "bearer",
      scope: ["chat:read", "chat:edit"],
    });
  });

  it.each([
    null,
    {},
    { access_token: "", refresh_token: "r", expires_in: 1, token_type: "bearer" },
    { access_token: "a", refresh_token: "r", expires_in: -1, token_type: "bearer" },
    { access_token: "a", refresh_token: "r", expires_in: 1.5, token_type: "bearer" },
    { access_token: "a", refresh_token: "r", expires_in: 1, token_type: "bearer", scope: [1] },
  ])("rejects malformed token JSON %#", (value) => {
    expect(parseTwitchTokenResponse(value)).toBeNull();
  });
});

describe("parseTwitchHelixUser", () => {
  it("parses a valid first Helix user", () => {
    expect(
      parseTwitchHelixUser({ data: [{ id: "123", login: "dirework_bot", display_name: "Bot" }] }),
    ).toEqual({ id: "123", login: "dirework_bot", display_name: "Bot" });
  });

  it.each([
    {},
    { data: [] },
    { data: [{ id: "abc", login: "bot", display_name: "Bot" }] },
    { data: [{ id: "123", login: "bad login", display_name: "Bot" }] },
    { data: [{ id: "123", login: "bot", display_name: "" }] },
  ])("rejects malformed user JSON %#", (value) => {
    expect(parseTwitchHelixUser(value)).toBeNull();
  });
});

describe("isTimeoutError", () => {
  it("recognizes Worker and fetch timeout error names", () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      const error = new Error("redacted");
      error.name = name;
      expect(isTimeoutError(error)).toBe(true);
    }
    expect(isTimeoutError(new Error("network"))).toBe(false);
  });
});

describe("bounded OAuth callback state", () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

  it("accepts bounded callback parameters and a state issued by Dirework", () => {
    const nonce = "a".repeat(64);
    const state = encode({ userId: "owner-id", nonce });
    expect(parseOAuthCallbackParams("code", state)).toEqual({ code: "code", state });
    expect(parseBotOAuthState(state)).toEqual({ userId: "owner-id", nonce });
  });

  it("rejects oversized callback fields and malformed state payloads", () => {
    expect(parseOAuthCallbackParams("x".repeat(4097), "state")).toBeNull();
    expect(parseOAuthCallbackParams("code", "x".repeat(1025))).toBeNull();
    expect(parseBotOAuthState(encode({ userId: "owner-id", nonce: "short" }))).toBeNull();
    expect(parseBotOAuthState("x".repeat(1025))).toBeNull();
  });
});
