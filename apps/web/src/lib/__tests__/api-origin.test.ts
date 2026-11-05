import { afterEach, describe, expect, it, vi } from "vitest";

import { apiOrigin, webOrigin } from "../api-origin";

describe("apiOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses NEXT_PUBLIC_SERVER_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://dirework-api.example.workers.dev");
    expect(apiOrigin()).toBe("https://dirework-api.example.workers.dev");
  });

  it("falls back to localhost when the variable is EMPTY, not only when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "");
    expect(apiOrigin()).toBe("http://localhost:3000");
  });

  it("strips trailing slashes so path joins never double up", () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://api.example//");
    expect(`${apiOrigin()}/trpc`).toBe("https://api.example/trpc");
  });
});

describe("webOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses BETTER_AUTH_URL, the web origin, when set", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://dirework.example.workers.dev");
    expect(webOrigin()).toBe("https://dirework.example.workers.dev");
  });

  it("falls back to localhost when the variable is EMPTY, not only when unset", () => {
    // `??` let an empty value through: robots.txt then named a relative sitemap.
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(webOrigin()).toBe("http://localhost:3001");
  });

  it("strips trailing slashes so path joins never double up", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://x.dev/");
    expect(`${webOrigin()}/sitemap.xml`).toBe("https://x.dev/sitemap.xml");
  });

  it("is the one reader of BETTER_AUTH_URL in metadata, robots and the sitemap", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    const [{ default: robots }, { default: sitemap }] = await Promise.all([
      import("../../app/robots"),
      import("../../app/sitemap"),
    ]);
    expect(robots().sitemap).toBe("http://localhost:3001/sitemap.xml");
    expect(sitemap()[0].url).toBe("http://localhost:3001");
  });
});
