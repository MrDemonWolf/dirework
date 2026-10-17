import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildRequestLog, getRequestId, requestLogger } from "../logger";

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

describe("requestLogger middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stamps x-request-id, exposes the same id on the context, and logs no query string", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let idInHandler: string | undefined;
    const app = new Hono();
    app.use(requestLogger());
    app.get("/x", (c) => {
      idInHandler = getRequestId(c);
      return c.text("ok", 201);
    });

    const res = await app.request("/x?code=secret");

    const header = res.headers.get("x-request-id");
    expect(header).toBeTruthy();
    expect(idInHandler).toBe(header);

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).not.toContain("secret");
    expect(line).not.toContain("code=");
    expect(line).not.toContain("?");
    expect(JSON.parse(line)).toMatchObject({ id: header, method: "GET", path: "/x", status: 201 });
  });

  it("returns undefined from getRequestId when the middleware has not run", async () => {
    let id: string | undefined = "unset";
    const app = new Hono();
    app.get("/x", (c) => {
      id = getRequestId(c);
      return c.text("ok");
    });

    await app.request("/x");

    expect(id).toBeUndefined();
  });
});
