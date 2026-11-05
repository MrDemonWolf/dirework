import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BUILD_ID_HEADER } from "@dirework/api/build-id";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { describe, expect, it } from "vitest";

import { buildIdHeader } from "../build-id";

function app(buildId: string | undefined) {
  const hono = new Hono();
  hono.use(buildIdHeader(buildId));
  hono.use(cors({ origin: "https://web.example", exposeHeaders: [BUILD_ID_HEADER] }));
  hono.post("/trpc/overlay.getTimerState", (c) => c.json({ result: { data: null } }));
  hono.get("/boom", () => {
    throw new Error("boom");
  });
  return hono;
}

describe("build id header", () => {
  it("stamps every answer, errors included, and CORS lets the web origin read it", async () => {
    const res = await app("413ff22").request("/trpc/overlay.getTimerState", {
      method: "POST",
      headers: { Origin: "https://web.example" },
    });
    expect(res.headers.get(BUILD_ID_HEADER)).toBe("413ff22");
    expect(res.headers.get("access-control-expose-headers")).toContain(BUILD_ID_HEADER);
    expect((await app("413ff22").request("/boom")).headers.get(BUILD_ID_HEADER)).toBe("413ff22");
  });

  it("sends nothing without a real sha", async () => {
    for (const id of [undefined, "", "dev"]) {
      const res = await app(id).request("/trpc/overlay.getTimerState", { method: "POST" });
      expect(res.headers.has(BUILD_ID_HEADER)).toBe(false);
    }
  });
});

describe("the api worker", () => {
  const index = readFileSync(resolve(import.meta.dirname, "../../index.ts"), "utf8");

  it("stamps its BUILD_ID binding on every answer and exposes it to the web origin", () => {
    expect(index).toContain("app.use(buildIdHeader(env.BUILD_ID));");
    // Outermost after the logger: the rate limiter's 429s carry it too.
    expect(index.indexOf("buildIdHeader(env.BUILD_ID)")).toBeLessThan(
      index.indexOf("app.use(rateLimiter())"),
    );
    expect(index).toContain("exposeHeaders: [BUILD_ID_HEADER],");
  });
});
