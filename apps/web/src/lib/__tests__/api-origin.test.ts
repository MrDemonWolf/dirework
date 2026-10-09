import { afterEach, describe, expect, it, vi } from "vitest";

import { apiOrigin } from "../api-origin";

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
