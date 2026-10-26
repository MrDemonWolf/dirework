import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb } from "./stubs/test-db";

/**
 * Drives the REAL better-auth instance from createAuth() against an in-memory
 * SQLite database with the real schema. Only the D1 binding (createDb) is
 * swapped; every hook, option and route is the production one.
 */

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@dirework/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dirework/db")>()),
  createDb: () => testDb.current,
}));

import { DEV_LOGIN_SECRET_HEADER } from "../dev-login";
import { createAuth, DISABLED_AUTH_PATHS, twitchPlaceholderEmail } from "../index";

const ORIGIN = "http://localhost:3001";
/** Matches DEV_LOGIN_SECRET in stubs/cloudflare-workers.ts. */
const DEV_SECRET = "test-dev-login-secret";
const mutableEnv = env as unknown as Record<string, string | undefined>;
let db: DbClient;

beforeEach(async () => {
  db = await createTestDb();
  testDb.current = db;
  mutableEnv.DEV_LOGIN = undefined;
});

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return createAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

/** The provisioning source better-auth 1.7 passes for a Twitch OAuth sign-in. */
const TWITCH_SOURCE = { method: "oauth", oauth: { providerId: "twitch" } } as const;

async function createOwner() {
  const ctx = await createAuth().$context;
  const owner = await ctx.internalAdapter.createUser(
    { name: "Streamer", email: "streamer@example.test", emailVerified: true },
    TWITCH_SOURCE,
  );
  await ctx.internalAdapter.createAccount({
    userId: owner.id,
    providerId: "twitch",
    accountId: "111",
  });
  return { ctx, owner };
}

describe("createAuth: single-owner claim", () => {
  it("makes the first created user the owner", async () => {
    const { owner } = await createOwner();
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, owner.id));
    expect(row?.isOwner).toBe(true);
  });

  it("refuses to create a second user", async () => {
    const { ctx } = await createOwner();
    await expect(
      ctx.internalAdapter.createUser(
        { name: "Intruder", email: "intruder@example.test" },
        TWITCH_SOURCE,
      ),
    ).rejects.toThrow(/instance_claimed/);
    expect(await db.select().from(schema.user)).toHaveLength(1);
  });

  it("does not link a second Twitch account that shares the owner's verified email", async () => {
    const { ctx, owner } = await createOwner();

    const result = await handleOAuthUserInfo({ context: ctx } as never, {
      userInfo: {
        id: "999",
        name: "StreamerBot",
        email: owner.email,
        emailVerified: true,
      },
      account: { providerId: "twitch", accountId: "999" },
    });

    expect(result.error).toBe("account not linked");
    const accounts = await db.select({ accountId: schema.account.accountId }).from(schema.account);
    expect(accounts.map((a) => a.accountId)).toEqual(["111"]);
    expect(await db.select().from(schema.session)).toHaveLength(0);
  });
});

const TWITCH_ISSUER = "https://id.twitch.tv/oauth2";
const TWITCH_JWKS_URL = "https://id.twitch.tv/oauth2/keys";
const TEST_KID = "dirework-test-key";

/** An RS256 key pair standing in for one of Twitch's id_token signing keys. */
async function generateSigningKey(): Promise<CryptoKeyPair> {
  // RSA algorithms always yield a pair; the lib typing returns a key-or-pair union.
  return (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

// One "Twitch" key for the whole file: better-auth caches the JWKS it fetches,
// so rotating keys between tests would test the cache, not the sign-in.
const twitchKey = generateSigningKey();

/**
 * A Twitch-shaped id_token signed RS256. better-auth (1.7.11+) verifies it
 * against Twitch's JWKS (issuer, audience = our client id, exp/iat), so the
 * test signs a real one instead of a bare `alg: none` token.
 */
async function signedIdToken(claims: Record<string, unknown>, key: CryptoKeyPair) {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64({ alg: "RS256", typ: "JWT", kid: TEST_KID })}.${b64({
    iss: TWITCH_ISSUER,
    aud: env.TWITCH_CLIENT_ID,
    iat: now,
    exp: now + 900,
    ...claims,
  })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

/**
 * Drives the real Twitch OAuth round trip: /sign-in/social mints the state,
 * then /callback/twitch exchanges a code (Twitch's token and JWKS endpoints
 * are stubbed) for an id_token naming `sub`. `signWith` signs the token with a
 * key Twitch's JWKS does NOT publish, to model a forged token. Returns the
 * callback response (a redirect).
 */
async function twitchSignIn(sub: string, signWith?: CryptoKeyPair) {
  const start = await post("/sign-in/social", {
    provider: "twitch",
    callbackURL: "/dashboard",
    errorCallbackURL: "/",
    disableRedirect: true,
  });
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";
  const cookie = start.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const key = await twitchKey;
  const idToken = await signedIdToken({ sub, preferred_username: `user${sub}` }, signWith ?? key);
  const publicJwk = await crypto.subtle.exportKey("jwk", key.publicKey);

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target === TWITCH_JWKS_URL) {
      return Response.json({ keys: [{ ...publicJwk, kid: TEST_KID, alg: "RS256", use: "sig" }] });
    }
    if (target !== "https://id.twitch.tv/oauth2/token")
      throw new Error(`unexpected fetch ${target}`);
    return Response.json({
      access_token: "owner-access",
      refresh_token: "owner-refresh",
      expires_in: 3600,
      token_type: "bearer",
      scope: ["openid"],
      id_token: idToken,
    });
  });
  try {
    return await createAuth().handler(
      new Request(`${ORIGIN}/api/auth/callback/twitch?code=test-code&state=${state}`, {
        headers: { cookie, "user-agent": "Test Browser/1.0", "x-forwarded-for": "203.0.113.9" },
      }),
    );
  } finally {
    fetchSpy.mockRestore();
  }
}

describe("createAuth: Twitch OAuth callback", () => {
  it("refuses an id_token not signed by Twitch and creates nothing", async () => {
    const res = await twitchSignIn("111", await generateSigningKey());

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/?error=unable_to_get_user_info");
    expect(await db.select().from(schema.user)).toHaveLength(0);
    expect(await db.select().from(schema.session)).toHaveLength(0);
  });

  it("claims the instance on the first sign-in without storing tokens, IP or user agent", async () => {
    const res = await twitchSignIn("111");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");
    const sessionCookie = res.headers.getSetCookie().find((c) => /session_token=[^;]/.test(c));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/Secure/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).not.toMatch(/Domain=/i);

    const users = await db.select().from(schema.user);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      isOwner: true,
      twitchId: "111",
      email: twitchPlaceholderEmail("111"),
    });
    const accounts = await db.select().from(schema.account);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      providerId: "twitch",
      accountId: "111",
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    const sessions = await db.select().from(schema.session);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ ipAddress: null, userAgent: null });
    const days = (sessions[0]!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("lets the owner sign in again without storing the refreshed tokens", async () => {
    await twitchSignIn("111");
    const res = await twitchSignIn("111");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(await db.select().from(schema.user)).toHaveLength(1);
    const accounts = await db.select().from(schema.account);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
    expect(await db.select().from(schema.session)).toHaveLength(2);
  });

  it("redirects a second Twitch account to ?error=instance_claimed and creates nothing", async () => {
    await twitchSignIn("111");
    const res = await twitchSignIn("999");

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location") ?? "", ORIGIN);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("error")).toBe("instance_claimed");
    expect(res.headers.getSetCookie().some((c) => /session_token=[^;]/.test(c))).toBe(false);
    expect(await db.select().from(schema.user)).toHaveLength(1);
    expect((await db.select().from(schema.account)).map((a) => a.accountId)).toEqual(["111"]);
    expect(await db.select().from(schema.session)).toHaveLength(1);
  });
});

describe("createAuth: owner Twitch tokens are never stored", () => {
  it("drops tokens on account create and update", async () => {
    const { ctx, owner } = await createOwner();
    const created = await ctx.internalAdapter.createAccount({
      userId: owner.id,
      providerId: "twitch",
      accountId: "222",
      accessToken: "access",
      refreshToken: "refresh",
      idToken: "id-token",
    });
    await ctx.internalAdapter.updateAccount(created.id, {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      idToken: "id-token-2",
    });

    const [row] = await db.select().from(schema.account).where(eq(schema.account.id, created.id));
    expect(row).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
  });
});

describe("createAuth: Twitch provider", () => {
  it("requests only the openid scope (no user:read:email)", async () => {
    const res = await post("/sign-in/social", { provider: "twitch", disableRedirect: true });
    const { url } = (await res.json()) as { url: string };
    // Without user:read:email Twitch withholds the email claim that better-auth
    // lists in every authorize URL, so the privacy policy's wording holds.
    expect(new URL(url).searchParams.get("scope")).toBe("openid");
  });

  it("asks only for the id_token claims it maps (plus better-auth's forced email pair)", async () => {
    const res = await post("/sign-in/social", { provider: "twitch", disableRedirect: true });
    const { url } = (await res.json()) as { url: string };
    const claims = JSON.parse(new URL(url).searchParams.get("claims") ?? "{}") as {
      id_token?: Record<string, null>;
    };
    // better-auth (1.6, still in 1.7) always merges email/email_verified in (the privacy policy
    // says so). If this ever drops them, update the policy and the comment in
    // createAuth — the configured claims would then be the whole request.
    expect(Object.keys(claims.id_token ?? {}).sort()).toEqual(
      ["email", "email_verified", "picture", "preferred_username"].sort(),
    );
    expect(createAuth().options.socialProviders.twitch.claims).toEqual([
      "preferred_username",
      "picture",
    ]);
  });

  it("maps the profile to a placeholder email, not a real one", async () => {
    const twitch = createAuth().options.socialProviders.twitch;
    const mapped = await twitch.mapProfileToUser?.({
      sub: "42",
      preferred_username: "Streamer",
      email: "real@example.test",
    } as never);

    expect(mapped).toMatchObject({
      email: twitchPlaceholderEmail("42"),
      emailVerified: false,
      twitchId: "42",
      displayName: "Streamer",
    });
  });
});

describe("createAuth: endpoint surface", () => {
  it.each(["/get-access-token", "/refresh-token", "/link-social", "/update-user", "/delete-user"])(
    "%s is disabled",
    async (path) => {
      const res = await post(path);
      expect(res.status).toBe(404);
    },
  );

  it("does not answer the password-reset email link (a parameterized route)", async () => {
    const res = await createAuth().handler(
      new Request(`${ORIGIN}/api/auth/reset-password/some-token?callbackURL=/`),
    );
    expect(res.status).toBe(404);
  });

  it("routes only the endpoints Dirework reviewed (a better-auth bump adding one fails here)", () => {
    const routed = Object.values(createAuth().api as Record<string, { path?: string }>)
      .map((endpoint) => endpoint.path)
      .filter((path): path is string => !!path && !DISABLED_AUTH_PATHS.includes(path));
    // If this fails after a dependency bump, decide for each new path whether
    // Dirework uses it; add every unused one to DISABLED_AUTH_PATHS.
    expect([...new Set(routed)].sort()).toEqual([
      "/callback/:id",
      "/error",
      "/get-session",
      "/list-sessions",
      "/ok",
      "/reset-password/:token", // routed, but 404s via DISABLED_AUTH_PATH_PREFIXES
      "/revoke-other-sessions",
      "/revoke-session",
      "/revoke-sessions",
      "/sign-in/social",
      "/sign-out",
    ]);
  });
});

describe("createAuth: dev-login gate", () => {
  it.each([undefined, "false", "1"])("is not routed when DEV_LOGIN=%j", async (flag) => {
    mutableEnv.DEV_LOGIN = flag;
    const res = await post("/dev-login");
    expect(res.status).toBe(404);
    expect(await db.select().from(schema.user)).toHaveLength(0);
  });

  it('mints an owner session when DEV_LOGIN="true"', async () => {
    mutableEnv.DEV_LOGIN = "true";
    const res = await post("/dev-login", undefined, {
      "user-agent": "Test Browser/1.0",
      [DEV_LOGIN_SECRET_HEADER]: DEV_SECRET,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const [user] = await db.select().from(schema.user);
    expect(user?.isOwner).toBe(true);
    // The session-create hook provisioned the singleton config rows.
    expect(await db.select().from(schema.timerConfig)).toHaveLength(1);
  });

  it.each([
    ["no secret", {}],
    ["a wrong secret", { [DEV_LOGIN_SECRET_HEADER]: "guess" }],
  ])('refuses a request with %s even when DEV_LOGIN="true"', async (_label, headers) => {
    mutableEnv.DEV_LOGIN = "true";
    const res = await post("/dev-login", undefined, headers as Record<string, string>);

    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await db.select().from(schema.user)).toHaveLength(0);
  });

  it("refuses every request when no secret is configured", async () => {
    mutableEnv.DEV_LOGIN = "true";
    mutableEnv.DEV_LOGIN_SECRET = "";
    try {
      const res = await post("/dev-login", undefined, { [DEV_LOGIN_SECRET_HEADER]: "" });
      expect(res.status).toBe(403);
    } finally {
      mutableEnv.DEV_LOGIN_SECRET = DEV_SECRET;
    }
  });
});

describe("createAuth: session rows", () => {
  it("stores no IP or user agent and purges expired sessions and verifications at sign-in", async () => {
    mutableEnv.DEV_LOGIN = "true";
    await post("/dev-login", undefined, { [DEV_LOGIN_SECRET_HEADER]: DEV_SECRET });
    const [user] = await db.select().from(schema.user);
    await db.insert(schema.session).values({
      id: "expired",
      token: "expired-token",
      userId: user!.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    await db.insert(schema.verification).values({
      id: "abandoned",
      identifier: "abandoned-state",
      value: "v",
      expiresAt: new Date(Date.now() - 1000),
    });

    await post("/dev-login", undefined, {
      "user-agent": "Test Browser/1.0",
      "x-forwarded-for": "203.0.113.7",
      [DEV_LOGIN_SECRET_HEADER]: DEV_SECRET,
    });

    const sessions = await db.select().from(schema.session);
    expect(sessions.map((s) => s.id)).not.toContain("expired");
    const verifications = await db.select().from(schema.verification);
    expect(verifications.map((v) => v.id)).not.toContain("abandoned");
    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      expect(s.ipAddress).toBeNull();
      expect(s.userAgent).toBeNull();
    }
  });
});
