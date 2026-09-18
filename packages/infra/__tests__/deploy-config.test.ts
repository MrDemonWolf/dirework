import { describe, expect, it } from "vitest";

import {
  assertProductionEnvironment,
  getDevLoginSettings,
  isCiRun,
  isDevelopmentRun,
  productionEnvironmentErrors,
  type DeployEnvironment,
} from "../deploy-config";

const validEnvironment: DeployEnvironment = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token",
  ALCHEMY_PASSWORD: "a".repeat(32),
  ALCHEMY_STATE_TOKEN: "s".repeat(32),
  BETTER_AUTH_SECRET: "b".repeat(32),
  TWITCH_CLIENT_ID: "client-id",
  TWITCH_CLIENT_SECRET: "client-secret",
  BETTER_AUTH_URL: "https://dirework.example.com",
  CORS_ORIGIN: "https://dirework.example.com",
};

describe("CI environment detection", () => {
  it("requires the exact true value", () => {
    expect(isCiRun({ CI: "true" })).toBe(true);
    expect(isCiRun({ CI: "false" })).toBe(false);
    expect(isCiRun({})).toBe(false);
  });
});

describe("development login deployment gate", () => {
  it("only recognizes an explicit --dev command", () => {
    expect(isDevelopmentRun(["tsx", "alchemy.run.ts", "--dev"])).toBe(true);
    expect(isDevelopmentRun(["tsx", "alchemy.run.ts"])).toBe(false);
  });

  it("forces both bindings off for a production command", () => {
    expect(
      getDevLoginSettings({ DEV_LOGIN: "true", NEXT_PUBLIC_DEV_LOGIN: "true" }, [
        "tsx",
        "alchemy.run.ts",
      ]),
    ).toEqual({ server: "false", client: "" });
  });

  it("allows each explicit flag only during local development", () => {
    expect(
      getDevLoginSettings({ DEV_LOGIN: "true", NEXT_PUBLIC_DEV_LOGIN: "true" }, [
        "tsx",
        "alchemy.run.ts",
        "--dev",
      ]),
    ).toEqual({ server: "true", client: "true" });
  });
});

describe("production environment validation", () => {
  it("accepts a complete same-origin HTTPS configuration", () => {
    expect(() => assertProductionEnvironment(validEnvironment)).not.toThrow();
  });

  it("reports missing values without including any secret value", () => {
    const errors = productionEnvironmentErrors({});
    expect(errors).toContain("CLOUDFLARE_API_TOKEN is required");
    expect(errors).toContain("BETTER_AUTH_SECRET is required");
  });

  it("requires the remote state token in CI", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      CI: "true",
      ALCHEMY_STATE_TOKEN: undefined,
    });
    expect(errors).toContain("ALCHEMY_STATE_TOKEN is required in CI");
  });

  it("rejects short deployment secrets", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      BETTER_AUTH_SECRET: "short",
      ALCHEMY_PASSWORD: "short",
      ALCHEMY_STATE_TOKEN: "short",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET must be at least 32 characters",
        "ALCHEMY_PASSWORD must be at least 32 characters",
        "ALCHEMY_STATE_TOKEN must be at least 32 characters",
      ]),
    );
  });

  it("rejects HTTP, paths, and mismatched web origins", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      BETTER_AUTH_URL: "http://dirework.example.com/path",
      CORS_ORIGIN: "https://other.example.com",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_URL must use https in production",
        "BETTER_AUTH_URL must be an origin only (for example https://app.example.com)",
        "BETTER_AUTH_URL and CORS_ORIGIN must be the same web origin",
      ]),
    );
  });

  it("rejects development bypass flags and unsafe optional URLs", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      DEV_LOGIN: "true",
      DOCS_URL: "javascript:alert(1)",
      PRIVACY_POLICY_URL: "not-a-url",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "development login flags must be unset for production deploys",
        "DOCS_URL must use https in production",
        "PRIVACY_POLICY_URL must be a valid absolute URL when set",
      ]),
    );
  });
});

describe("production environment edge cases", () => {
  it("rejects invalid origins, URL metadata, and optional URL credentials", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      BETTER_AUTH_URL: "not-an-absolute-url",
      CORS_ORIGIN: "https://user:pass@dirework.example.com?source=test#fragment",
      TERMS_OF_SERVICE_URL: "https://user:pass@example.com/terms",
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_URL must be a valid absolute URL",
        "CORS_ORIGIN must not include credentials, a query, or a fragment",
        "CORS_ORIGIN must be an origin only (for example https://app.example.com)",
        "TERMS_OF_SERVICE_URL must not include URL credentials",
      ]),
    );
  });

  it("throws a redacted aggregate error for an invalid production environment", () => {
    const leakedSecret = "do-not-leak";

    expect(() =>
      assertProductionEnvironment({
        ...validEnvironment,
        BETTER_AUTH_SECRET: leakedSecret,
      }),
    ).toThrow("Invalid production deployment configuration");

    try {
      assertProductionEnvironment({
        ...validEnvironment,
        BETTER_AUTH_SECRET: leakedSecret,
      });
    } catch (error) {
      expect(String(error)).not.toContain(leakedSecret);
    }
  });
});
