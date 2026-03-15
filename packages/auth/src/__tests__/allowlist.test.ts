import { describe, it, expect, vi } from "vitest";

// Mock dependencies so the auth module can load without env/db
vi.mock("@dirework/db", () => ({ db: {} }));
vi.mock("@dirework/db/schema", () => ({
  timerConfig: {},
  timerStyle: {},
  taskStyle: {},
  botConfig: {},
}));
vi.mock("@dirework/env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost",
    TWITCH_CLIENT_ID: "test",
    TWITCH_CLIENT_SECRET: "test",
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3001",
    ALLOWED_TWITCH_IDS: "",
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

import { parseAllowedTwitchIds } from "../index";

describe("parseAllowedTwitchIds", () => {
  it("returns an empty set for undefined input", () => {
    const result = parseAllowedTwitchIds(undefined);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns an empty set for an empty string", () => {
    const result = parseAllowedTwitchIds("");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns a set with one entry for a single ID", () => {
    const result = parseAllowedTwitchIds("12345");
    expect(result.size).toBe(1);
    expect(result.has("12345")).toBe(true);
  });

  it("returns a set with all entries for comma-separated IDs", () => {
    const result = parseAllowedTwitchIds("111,222,333");
    expect(result.size).toBe(3);
    expect(result.has("111")).toBe(true);
    expect(result.has("222")).toBe(true);
    expect(result.has("333")).toBe(true);
  });

  it("trims whitespace around IDs", () => {
    const result = parseAllowedTwitchIds("  111 , 222 , 333  ");
    expect(result.size).toBe(3);
    expect(result.has("111")).toBe(true);
    expect(result.has("222")).toBe(true);
    expect(result.has("333")).toBe(true);
  });

  it("handles trailing commas and empty segments", () => {
    const result = parseAllowedTwitchIds("111,,222,,,333,");
    expect(result.size).toBe(3);
    expect(result.has("111")).toBe(true);
    expect(result.has("222")).toBe(true);
    expect(result.has("333")).toBe(true);
  });

  it("deduplicates repeated IDs", () => {
    const result = parseAllowedTwitchIds("111,222,111,333,222");
    expect(result.size).toBe(3);
    expect(result.has("111")).toBe(true);
    expect(result.has("222")).toBe(true);
    expect(result.has("333")).toBe(true);
  });
});
