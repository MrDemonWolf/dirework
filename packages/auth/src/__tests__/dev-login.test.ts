import { describe, it, expect, vi } from "vitest";

// dev-login.ts imports better-auth runtime helpers only to build the plugin;
// isDevLoginEnabled itself is pure. Stub the imports so the module loads without
// pulling the full better-auth runtime into the test.
vi.mock("better-auth/api", () => ({
  createAuthEndpoint: () => ({}),
  APIError: class extends Error {},
}));
vi.mock("better-auth/cookies", () => ({ setSessionCookie: vi.fn() }));

import { devLoginSecretMatches, isDevLoginEnabled } from "../dev-login";

describe("isDevLoginEnabled", () => {
  it('is true only for the exact string "true"', () => {
    expect(isDevLoginEnabled("true")).toBe(true);
  });

  it.each([undefined, "", "false", "1", "TRUE", "True", "yes", "0"])(
    "is false for %j (default-deny)",
    (value) => {
      expect(isDevLoginEnabled(value as string | undefined)).toBe(false);
    },
  );
});

describe("devLoginSecretMatches", () => {
  it("accepts only the exact configured secret", () => {
    expect(devLoginSecretMatches("s3cret-value", "s3cret-value")).toBe(true);
    expect(devLoginSecretMatches("s3cret-value", "s3cret-valuf")).toBe(false);
    expect(devLoginSecretMatches("s3cret-value", "s3cret")).toBe(false);
    expect(devLoginSecretMatches("s3cret-value", null)).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(devLoginSecretMatches(undefined, "anything")).toBe(false);
    expect(devLoginSecretMatches("", "")).toBe(false);
  });
});
