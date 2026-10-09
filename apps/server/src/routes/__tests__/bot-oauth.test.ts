import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WEB = "https://web.test";
const COOKIE = "__Host-dirework_bot_oauth_nonce";
const NONCE = "a".repeat(64);

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  upsert: vi.fn(async () => undefined),
  values: vi.fn(),
}));

vi.mock("@dirework/env/server", () => ({
  env: {
    BETTER_AUTH_URL: "https://web.test",
    TWITCH_CLIENT_ID: "client-id",
    TWITCH_CLIENT_SECRET: "client-secret",
  },
}));

vi.mock("@dirework/auth", () => ({
  createAuth: () => ({ api: { getSession: mocks.getSession } }),
}));

vi.mock("@dirework/db", async () => ({
  schema: await import("@dirework/db/schema"),
  createDb: () => ({
    insert: () => ({
      values: (row: unknown) => {
        mocks.values(row);
        return { onConflictDoUpdate: mocks.upsert };
      },
    }),
  }),
}));

const { botOAuth } = await import("../bot-oauth");

const owner = { user: { id: "owner-1", isOwner: true } };

function state(payload: { userId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function callback(query: Record<string, string>, cookie: string | null = `${COOKIE}=${NONCE}`) {
  const params = new URLSearchParams(query);
  return botOAuth.request(`/callback/twitch?${params}`, {
    headers: cookie ? { cookie } : {},
  });
}

/** The nonce cookie is single-use: every callback exit must expire it. */
function expectNonceCleared(res: Response) {
  const setCookie = res.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain(`${COOKIE}=;`);
  expect(setCookie).toMatch(/Max-Age=0/i);
}

function redirectReason(res: Response): string | null {
  return new URL(res.headers.get("location") ?? "").searchParams.get("reason");
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.upsert.mockReset();
  mocks.values.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /authorize", () => {
  it("redirects an anonymous visitor home with not_authenticated", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await botOAuth.request("/authorize");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${WEB}/?error=not_authenticated`);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a signed-in non-owner", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u2", isOwner: false } });
    const res = await botOAuth.request("/authorize");
    expect(res.headers.get("location")).toBe(`${WEB}/?error=not_owner`);
  });

  it("reads the session without sliding it", async () => {
    mocks.getSession.mockResolvedValue(owner);
    await botOAuth.request("/authorize");
    expect(mocks.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableRefresh: true } }),
    );
  });

  it("binds the httpOnly nonce cookie to the state sent to Twitch", async () => {
    mocks.getSession.mockResolvedValue(owner);
    const res = await botOAuth.request("/authorize");

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin).toBe("https://id.twitch.tv");
    const decoded = JSON.parse(
      Buffer.from(location.searchParams.get("state") ?? "", "base64url").toString(),
    );
    expect(decoded.userId).toBe("owner-1");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${COOKIE}=${decoded.nonce}`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
  });
});

describe("GET /callback/twitch", () => {
  it("treats a consent-screen cancel as a cancel, without reflecting Twitch text", async () => {
    const res = await callback({
      error: "access_denied",
      error_description: "The user denied <script>",
      state: state({ userId: "owner-1", nonce: NONCE }),
    });
    expect(res.headers.get("location")).toBe(`${WEB}/dashboard/bot?bot=cancelled`);
    expectNonceCleared(res);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the nonce even when code or state is missing", async () => {
    const res = await callback({ state: state({ userId: "owner-1", nonce: NONCE }) });
    expect(redirectReason(res)).toBe("missing_params");
    expectNonceCleared(res);
  });

  it("clears the nonce when state is malformed", async () => {
    const res = await callback({ code: "c", state: "not-base64-json" });
    expect(redirectReason(res)).toBe("invalid_state");
    expectNonceCleared(res);
  });

  it.each([
    ["missing", null],
    ["mismatched", `${COOKIE}=${"b".repeat(64)}`],
  ])("rejects a %s nonce cookie before contacting Twitch", async (_label, cookie) => {
    mocks.getSession.mockResolvedValue(owner);
    const res = await callback(
      { code: "c", state: state({ userId: "owner-1", nonce: NONCE }) },
      cookie,
    );
    expect(redirectReason(res)).toBe("state_mismatch");
    expectNonceCleared(res);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no session", null],
    ["a different user", { user: { id: "someone-else", isOwner: true } }],
    ["a non-owner", { user: { id: "owner-1", isOwner: false } }],
  ])("rejects %s before contacting Twitch", async (_label, session) => {
    mocks.getSession.mockResolvedValue(session);
    const res = await callback({ code: "c", state: state({ userId: "owner-1", nonce: NONCE }) });
    expect(redirectReason(res)).toBe("session_mismatch");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failed token exchange by status only and writes nothing", async () => {
    mocks.getSession.mockResolvedValue(owner);
    fetchMock.mockResolvedValueOnce(new Response("code=SECRET-CODE invalid", { status: 400 }));

    const res = await callback({
      code: "SECRET-CODE",
      state: state({ userId: "owner-1", nonce: NONCE }),
    });

    expect(redirectReason(res)).toBe("token_exchange_failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
    const logged = vi.mocked(console.log).mock.calls.map((call) => String(call[0]));
    expect(logged).toContainEqual(expect.stringContaining('"label":"token_exchange_400"'));
    expect(logged.join("\n")).not.toContain("SECRET-CODE");
  });

  function stubTwitchSuccess() {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          access_token: "bot-access",
          refresh_token: "bot-refresh",
          expires_in: 3600,
          token_type: "bearer",
          scope: ["chat:read", "chat:edit"],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: [{ id: "42", login: "botty", display_name: "Botty" }] }),
      );
  }

  it("stores the bot account and redirects connected on success", async () => {
    mocks.getSession.mockResolvedValue(owner);
    stubTwitchSuccess();

    const res = await callback({ code: "c", state: state({ userId: "owner-1", nonce: NONCE }) });

    expect(res.headers.get("location")).toBe(`${WEB}/dashboard/bot?bot=connected`);
    expectNonceCleared(res);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        twitchId: "42",
        username: "botty",
        accessToken: "bot-access",
        refreshToken: "bot-refresh",
        scopes: ["chat:read", "chat:edit"],
        refreshLockedUntil: null,
      }),
    );
    // A reconnect clears any refresh lease held against the old tokens.
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ refreshLockedUntil: null }) }),
    );
    // Tokens live only in D1 — never in the redirect.
    expect(res.headers.get("location")).not.toContain("bot-access");
  });

  it("redacts a failed upsert: name only, never the statement carrying tokens", async () => {
    mocks.getSession.mockResolvedValue(owner);
    stubTwitchSuccess();
    const dbError = new Error("D1_ERROR: INSERT ... 'bot-refresh'");
    dbError.name = "D1Error";
    mocks.upsert.mockRejectedValueOnce(dbError);

    const res = await callback({ code: "c", state: state({ userId: "owner-1", nonce: NONCE }) });

    expect(redirectReason(res)).toBe("db_error");
    const errors = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
    expect(errors).toContainEqual(expect.stringContaining('"name":"D1Error"'));
    expect(errors.join("\n")).not.toContain("bot-refresh");
  });
});
