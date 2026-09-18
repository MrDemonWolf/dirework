import { describe, expect, it } from "vitest";

import { buildErrorEvent, buildMetric } from "../telemetry";

describe("buildMetric", () => {
  it("emits a closed-shape counter event", () => {
    expect(buildMetric("ratelimit.rejected", { requestId: "r1", label: "RL_BOT" })).toEqual({
      type: "metric",
      metric: "ratelimit.rejected",
      requestId: "r1",
      label: "RL_BOT",
      count: 1,
    });
  });

  it("drops a label that isn't a safe token", () => {
    // The guard exists so a caught error's message — which can carry a URL with
    // an OAuth code, or user-supplied task text — can never become a dimension.
    const event = buildMetric("oauth.failure", {
      label: "https://id.twitch.tv/oauth2/token?code=SECRET123",
    });
    expect(event.label).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("SECRET123");
  });

  it("drops an over-long label", () => {
    expect(buildMetric("db.error", { label: "a".repeat(200) }).label).toBeUndefined();
  });

  it("omits requestId entirely when absent", () => {
    expect(buildMetric("bot.reconnect")).not.toHaveProperty("requestId");
  });
});

describe("buildErrorEvent redaction", () => {
  it("keeps the error NAME but never the message", () => {
    const error = new Error(
      "D1_ERROR: near \"INSERT INTO bot_account (access_token='oauth:LEAKED')\"",
    );
    error.name = "D1Error";

    const event = buildErrorEvent({ error, requestId: "r2" });

    expect(event.name).toBe("D1Error");
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("LEAKED");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("INSERT");
  });

  it("drops an unsafe or secret-bearing error name", () => {
    const error = new Error("safe message");
    error.name = "OAuthError token=SECRET";
    const event = buildErrorEvent({ error });
    expect(event.name).toBe("Error");
    expect(JSON.stringify(event)).not.toContain("SECRET");
  });

  it("never includes a stack trace", () => {
    const event = buildErrorEvent({ error: new Error("boom") });
    expect(JSON.stringify(event)).not.toMatch(/at |\.ts:\d+|stack/i);
  });

  it("reduces a url to its pathname, dropping OAuth query parameters", () => {
    const event = buildErrorEvent({
      error: new Error("x"),
      url: "https://api.test/api/bot/callback/twitch?code=abc123&state=nonce789",
    });
    expect(event.path).toBe("/api/bot/callback/twitch");
    const serialized = JSON.stringify(event);
    for (const secret of ["abc123", "nonce789", "code=", "state=", "?"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("handles a non-Error throw without leaking its contents", () => {
    const event = buildErrorEvent({ error: { token: "oauth:SECRET" } });
    expect(event.name).toBe("UnknownError");
    expect(JSON.stringify(event)).not.toContain("SECRET");
  });

  it("only keeps a reason from the safe-token set", () => {
    expect(buildErrorEvent({ error: new Error("x"), reason: "readiness_db_ping" }).reason).toBe(
      "readiness_db_ping",
    );
    expect(
      buildErrorEvent({ error: new Error("x"), reason: "failed for user @bob: buy milk" }).reason,
    ).toBeUndefined();
  });
});
