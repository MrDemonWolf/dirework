import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { requireJsonMutations } from "../require-json";

function makeApp() {
  const app = new Hono();
  app.use("/trpc/*", requireJsonMutations());
  app.all("/trpc/*", (c) => c.text("reached"));
  return app;
}

describe("requireJsonMutations", () => {
  it("rejects CORS-simple POST bodies that skip the preflight", async () => {
    const app = makeApp();
    const form = new FormData();
    form.set("x", "1");
    for (const init of [
      { body: form },
      { body: "a=1", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      { body: "{}", headers: { "Content-Type": "text/plain" } },
      { body: "{}" },
    ]) {
      const res = await app.request("/trpc/task.clearAll", { method: "POST", ...init });
      expect(res.status).toBe(415);
    }
  });

  it("lets JSON mutations and GET queries through", async () => {
    const app = makeApp();
    const post = await app.request("/trpc/task.clearAll", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: "{}",
    });
    expect(await post.text()).toBe("reached");
    const get = await app.request("/trpc/task.list");
    expect(await get.text()).toBe("reached");
  });
});
