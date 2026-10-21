import { expect, test } from "@playwright/test";

import { API_ORIGIN, WEB_ORIGIN } from "../src/env";

test("the landing page renders and both workers report healthy", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Twitch" })).toBeVisible();

  const version = await request.get("/api/version");
  expect(version.ok()).toBe(true);
  expect(await version.json()).toHaveProperty("sha");

  const ready = await request.get(`${API_ORIGIN}/ready`);
  // boot-api.ts binds no rate limiters, so /ready names all four as missing — and
  // stays 200, because the limiter fails open and readiness must not flap on it.
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toMatchObject({
    status: "ready",
    db: "ok",
    limits: "missing:RL_AUTH,RL_BOT,RL_TOKEN,RL_OVERLAY",
  });
});

test("the dashboard sends a signed-out visitor home", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
});
