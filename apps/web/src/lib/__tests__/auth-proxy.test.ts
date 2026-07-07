import { describe, expect, it } from "vitest";

import { buildTargetUrl, forwardHeaders } from "../auth-proxy";

const API = "https://dirework-api.mrdemonwolf.workers.dev";

describe("buildTargetUrl", () => {
  it("maps path + query onto the api origin", () => {
    expect(
      buildTargetUrl(
        "https://dirework.mrdemonwolf.workers.dev/api/auth/callback/twitch?code=abc&state=xyz",
        API,
      ),
    ).toBe(`${API}/api/auth/callback/twitch?code=abc&state=xyz`);
  });

  it("preserves encoded query characters (OAuth scopes)", () => {
    expect(
      buildTargetUrl(
        "https://dirework.mrdemonwolf.workers.dev/api/auth/callback/twitch?scope=user%3Aread%3Aemail+openid",
        API,
      ),
    ).toBe(`${API}/api/auth/callback/twitch?scope=user%3Aread%3Aemail+openid`);
  });

  it("handles paths without a query string", () => {
    expect(buildTargetUrl("http://localhost:3001/api/bot/authorize", "http://localhost:3000")).toBe(
      "http://localhost:3000/api/bot/authorize",
    );
  });
});

describe("forwardHeaders", () => {
  it("keeps cookies and content-type, strips host and content-length", () => {
    const headers = forwardHeaders(
      new Headers({
        cookie: "__Secure-better-auth.state=abc",
        "content-type": "application/json",
        host: "dirework.mrdemonwolf.workers.dev",
        "content-length": "42",
        connection: "keep-alive",
      }),
    );
    expect(headers.get("cookie")).toBe("__Secure-better-auth.state=abc");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("host")).toBeNull();
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("connection")).toBeNull();
  });
});
