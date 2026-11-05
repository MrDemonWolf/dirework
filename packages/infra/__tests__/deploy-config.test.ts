import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND } from "../../overlay-kit/src/index";
import {
  assertProductionEnvironment,
  DEFAULT_DOCS_URL,
  getDevLoginSettings,
  LOCAL_DEV_ALCHEMY_PASSWORD,
  rateLimitBindingsFor,
  resolveAlchemyPassword,
  resolveBuildId,
  resolveDevLoginSecret,
  resolveProxySecret,
  isCiRun,
  isDevelopmentRun,
  productionEnvironmentErrors,
  resolveDeployStage,
  type DeployEnvironment,
} from "../deploy-config";

const validEnvironment: DeployEnvironment = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token",
  ALCHEMY_PASSWORD: "a".repeat(32),
  ALCHEMY_STATE_TOKEN: "s".repeat(32),
  BETTER_AUTH_SECRET: "b".repeat(32),
  PROXY_SECRET: "p".repeat(32),
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

describe("deploy stage", () => {
  it("uses the pinned stage unless ALCHEMY_STAGE is set", () => {
    expect(resolveDeployStage({})).toBe("runner");
    expect(resolveDeployStage({ ALCHEMY_STAGE: "  " })).toBe("runner");
    expect(resolveDeployStage({ USER: "someone" })).toBe("runner");
    expect(resolveDeployStage({ ALCHEMY_STAGE: "staging" })).toBe("staging");
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
    expect(errors).toContain("PROXY_SECRET is required");
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
      PROXY_SECRET: "short",
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET must be at least 32 characters",
        "ALCHEMY_PASSWORD must be at least 32 characters",
        "ALCHEMY_STATE_TOKEN must be at least 32 characters",
        "PROXY_SECRET must be at least 32 characters",
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

describe("resolveDevLoginSecret", () => {
  it("is empty whenever the server dev-login flag is off", () => {
    expect(resolveDevLoginSecret({ DEV_LOGIN_SECRET: "pinned" }, "false")).toBe("");
  });

  it("uses a pinned secret, else a freshly generated one", () => {
    expect(resolveDevLoginSecret({ DEV_LOGIN_SECRET: " pinned " }, "true")).toBe("pinned");
    expect(resolveDevLoginSecret({}, "true", () => "generated")).toBe("generated");
    const a = resolveDevLoginSecret({}, "true");
    const b = resolveDevLoginSecret({}, "true");
    expect(a).toHaveLength(36);
    expect(a).not.toBe(b);
  });
});

describe("rateLimitBindingsFor", () => {
  const bindings = {
    RL_AUTH: { id: 1 },
    RL_BOT: { id: 2 },
    RL_TOKEN: { id: 3 },
    RL_OVERLAY: { id: 4 },
  };

  it("attaches every rate limiter to a deploy", () => {
    expect(rateLimitBindingsFor(bindings, false)).toBe(bindings);
  });

  it("attaches none in local dev, where alchemy 0.94 can't hand them to miniflare", () => {
    expect(rateLimitBindingsFor(bindings, true)).toEqual({});
  });
});

describe("alchemy.run.ts", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../alchemy.run.ts"), "utf8");

  it("binds the rate limiters only through rateLimitBindingsFor", () => {
    expect(source).toContain("...rateLimitBindingsFor(rateLimitBindings, isDevelopment)");
    expect(source.match(/RL_(AUTH|BOT|TOKEN|OVERLAY):/g)).toHaveLength(4);
  });

  it("always passes an explicit Alchemy state password", () => {
    expect(source).toContain("password: resolveAlchemyPassword(process.env, isDevelopment)");
  });

  it("binds the api worker's build id from resolveBuildId", () => {
    expect(source).toContain("BUILD_ID: resolveBuildId(),");
  });
});

describe("resolveAlchemyPassword", () => {
  it("uses ALCHEMY_PASSWORD in any mode", () => {
    expect(resolveAlchemyPassword({ ALCHEMY_PASSWORD: " pinned " }, false)).toBe("pinned");
    expect(resolveAlchemyPassword({ ALCHEMY_PASSWORD: "pinned" }, true)).toBe("pinned");
  });

  it("falls back to the same fixed password on every local dev run", () => {
    expect(resolveAlchemyPassword({}, true)).toBe(LOCAL_DEV_ALCHEMY_PASSWORD);
    expect(resolveAlchemyPassword({ ALCHEMY_PASSWORD: "  " }, true)).toBe(
      resolveAlchemyPassword({}, true),
    );
  });

  it("refuses to invent one for a production deploy", () => {
    expect(() => resolveAlchemyPassword({}, false)).toThrow("ALCHEMY_PASSWORD is required");
  });
});

describe("resolveProxySecret", () => {
  it("uses a pinned secret in any mode", () => {
    expect(resolveProxySecret({ PROXY_SECRET: " pinned " }, false)).toBe("pinned");
    expect(resolveProxySecret({ PROXY_SECRET: "pinned" }, true)).toBe("pinned");
  });

  it("generates a fresh secret for local dev only", () => {
    expect(resolveProxySecret({}, true, () => "generated")).toBe("generated");
    const a = resolveProxySecret({}, true);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(resolveProxySecret({}, true));
  });

  it("refuses to invent one for a production deploy", () => {
    expect(() => resolveProxySecret({}, false)).toThrow("PROXY_SECRET is required");
  });
});

describe("DEFAULT_DOCS_URL", () => {
  it("is BRAND's docs origin, and both workers fall back to it", () => {
    expect(DEFAULT_DOCS_URL).toBe(BRAND.links.docs);
    const program = readFileSync(resolve(import.meta.dirname, "../alchemy.run.ts"), "utf8");
    expect(program.match(/DOCS_URL: process\.env\.DOCS_URL \|\| DEFAULT_DOCS_URL,/g)).toHaveLength(
      2,
    );
  });
});

describe("resolveBuildId", () => {
  it("is the short commit sha, the same one the web build bakes in", () => {
    expect(resolveBuildId(() => "413ff22\n")).toBe("413ff22");
  });

  it('is "dev" without git, which the api never sends', () => {
    expect(
      resolveBuildId(() => {
        throw new Error("not a git repository");
      }),
    ).toBe("dev");
    expect(resolveBuildId(() => "")).toBe("dev");
  });

  it("matches next.config.ts's NEXT_PUBLIC_COMMIT_SHA command", () => {
    const nextConfig = readFileSync(
      resolve(import.meta.dirname, "../../../apps/web/next.config.ts"),
      "utf8",
    );
    expect(nextConfig).toContain('execSync("git rev-parse --short HEAD")');
  });
});
