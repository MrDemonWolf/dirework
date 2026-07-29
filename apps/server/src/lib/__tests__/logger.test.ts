import { describe, expect, it } from "vitest";

import { buildRequestLog } from "../logger";

describe("buildRequestLog redaction", () => {
  it("keeps only the pathname — never the query string", () => {
    const log = buildRequestLog({
      id: "req-1",
      method: "GET",
      url: "https://api.example.com/api/bot/callback/twitch?code=SECRET_CODE&state=SECRET_STATE",
      status: 302,
      ms: 12,
    });
    expect(log.path).toBe("/api/bot/callback/twitch");
    expect(log).toEqual({
      id: "req-1",
      method: "GET",
      path: "/api/bot/callback/twitch",
      status: 302,
      ms: 12,
    });
  });

  it.each([
    ["oauth code", "https://api.example.com/api/auth/callback/twitch?code=abc123def"],
    ["oauth state", "https://api.example.com/api/auth?state=csrf-nonce-xyz"],
    [
      "overlay token",
      "https://api.example.com/trpc/overlay.getTimerState?input=%7B%22token%22%3A%22t0ken%22%7D",
    ],
    ["bot token", "https://api.example.com/trpc/bot.ingest?token=b0tt0ken"],
  ])("serialized log for %s contains no secret", (_label, url) => {
    const serialized = JSON.stringify(
      buildRequestLog({ id: "x", method: "POST", url, status: 200, ms: 1 }),
    );
    for (const secret of [
      "abc123def",
      "csrf-nonce-xyz",
      "t0ken",
      "b0tt0ken",
      "?",
      "input=",
      "code=",
      "state=",
      "token=",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
