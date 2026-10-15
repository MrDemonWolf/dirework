import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";

import type { Context } from "../context";
import { redactInternalErrorShape } from "../index";
import { appRouter } from "../routers/index";

describe("tRPC client error redaction", () => {
  it("replaces internal messages and removes stack details", () => {
    const shape = {
      message: "D1_ERROR: statement included a secret value",
      data: { code: "INTERNAL_SERVER_ERROR", stack: "/srv/private/path.ts:42" },
    };

    expect(redactInternalErrorShape(shape, "INTERNAL_SERVER_ERROR")).toEqual({
      message: "Internal server error",
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
  });

  it("preserves intentional error messages but strips their stacks", () => {
    const shape = {
      message: "Owner access required",
      data: { code: "FORBIDDEN", stack: "at ownerProcedure (index.js:1:1)" },
    };

    expect(redactInternalErrorShape(shape, "FORBIDDEN")).toEqual({
      message: "Owner access required",
      data: { code: "FORBIDDEN" },
    });
  });
});

describe("error responses over HTTP carry no stack trace", () => {
  async function call(path: string, init?: RequestInit) {
    const res = await fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request(`http://localhost/trpc/${path}`, init),
      router: appRouter,
      createContext: () => ({ session: null, db: {} }) as unknown as Context,
    });
    return (await res.json()) as { error: { message: string; data: Record<string, unknown> } };
  }

  it("UNAUTHORIZED", async () => {
    const body = await call("user.me");
    expect(body.error.data.code).toBe("UNAUTHORIZED");
    expect(body.error.data).not.toHaveProperty("stack");
  });

  it("BAD_REQUEST", async () => {
    const body = await call("bot.getSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: 1 }),
    });
    expect(body.error.data.code).toBe("BAD_REQUEST");
    expect(body.error.data).not.toHaveProperty("stack");
  });
});
