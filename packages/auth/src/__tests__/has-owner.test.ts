import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  return { mockSelect, mockDb };
});

vi.mock("@dirework/db", () => ({ db: mockDb }));
vi.mock("@dirework/db/schema", () => ({
  user: {},
  timerConfig: {},
  timerStyle: {},
  taskStyle: {},
  botConfig: {},
  instanceConfig: {},
}));
vi.mock("@dirework/env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost",
    TWITCH_CLIENT_ID: "test",
    TWITCH_CLIENT_SECRET: "test",
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3001",
    DATABASE_URL: "postgres://localhost/test",
  },
}));
vi.mock("better-auth", () => ({ betterAuth: () => ({}) }));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: () => ({}),
}));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({}) }));
vi.mock("better-auth/api", () => ({
  APIError: class APIError extends Error {
    constructor(_code: string, opts: { message: string }) {
      super(opts.message);
    }
  },
}));
vi.mock("drizzle-orm", () => ({
  count: () => "count()",
}));

import { hasOwner } from "../index";

function mockUserCount(n: number) {
  mockSelect.mockReturnValue({
    from: () => Promise.resolve([{ count: n }]),
  });
}

describe("hasOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when no users exist", async () => {
    mockUserCount(0);
    expect(await hasOwner()).toBe(false);
  });

  it("returns true when one user exists", async () => {
    mockUserCount(1);
    expect(await hasOwner()).toBe(true);
  });

  it("returns true when multiple users exist", async () => {
    mockUserCount(3);
    expect(await hasOwner()).toBe(true);
  });
});
