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
import { createAuth, twitchPlaceholderEmail } from "../index";

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

async function createOwner() {
  const ctx = await createAuth().$context;
  const owner = await ctx.internalAdapter.createUser({
    name: "Streamer",
    email: "streamer@example.test",
    emailVerified: true,
  });
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
      ctx.internalAdapter.createUser({ name: "Intruder", email: "intruder@example.test" }),
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
    // better-auth 1.6 always merges email/email_verified in (the privacy policy
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
  it("stores no IP or user agent and purges expired sessions at sign-in", async () => {
    mutableEnv.DEV_LOGIN = "true";
    await post("/dev-login", undefined, { [DEV_LOGIN_SECRET_HEADER]: DEV_SECRET });
    const [user] = await db.select().from(schema.user);
    await db.insert(schema.session).values({
      id: "expired",
      token: "expired-token",
      userId: user!.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    await post("/dev-login", undefined, {
      "user-agent": "Test Browser/1.0",
      "x-forwarded-for": "203.0.113.7",
      [DEV_LOGIN_SECRET_HEADER]: DEV_SECRET,
    });

    const sessions = await db.select().from(schema.session);
    expect(sessions.map((s) => s.id)).not.toContain("expired");
    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      expect(s.ipAddress).toBeNull();
      expect(s.userAgent).toBeNull();
    }
  });
});
