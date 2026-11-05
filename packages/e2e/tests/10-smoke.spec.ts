import { expect, test } from "@playwright/test";

import { API_ORIGIN, WEB_ORIGIN } from "../src/env";
import { cspViolations, expectNoCspViolations, signIn, watchCsp } from "./helpers";

test("the landing page renders and both workers report healthy", async ({ page, request }) => {
  await watchCsp(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Twitch" })).toBeVisible();
  await expectNoCspViolations(page);

  // The share card is the static public/og.png (scripts/render-og.ts), not a Worker route.
  for (const name of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const url = new URL((await page.locator(name).getAttribute("content")) ?? "", WEB_ORIGIN);
    expect(url.pathname, name).toBe("/og.png");
  }
  const card = await request.get("/og.png");
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");

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

test("the CSP refuses an inline event handler injected into an overlay", async ({ page }) => {
  // The tasks overlay renders chat-supplied text, so it is where a markup-injection bug would
  // land, and an inline handler is that bug's classic payload.
  await signIn(page);
  const me = await page.request.get("/rpc/user.me");
  expect(me.ok(), `user.me answered ${me.status()}`).toBe(true);
  const { overlayTasksToken } = (
    (await me.json()) as { result: { data: { overlayTasksToken: string } } }
  ).result.data;
  await watchCsp(page);
  await page.goto(`/overlay/l/${overlayTasksToken}`);
  // The overlay rendered its first payload, so Next's inline <script> elements still run.
  await expect(
    page.locator("[data-task-row]").or(page.getByText("No tasks yet")).first(),
  ).toBeVisible();

  // The image can't decode, so its error event fires. The test's own listener runs after the
  // inline one, by which time the payload has run or been refused.
  const ran = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const holder = document.createElement("div");
        holder.innerHTML = `<img alt="" src="data:," onerror="window.__pwned = 1">`;
        holder.firstElementChild?.addEventListener("error", () => resolve("__pwned" in window));
        document.body.appendChild(holder);
      }),
  );
  expect(ran, "the injected onerror handler ran").toBe(false);
  // Refused by script-src-attr, and nothing else on the overlay tripped the policy.
  await expect
    .poll(() => cspViolations(page))
    .toEqual([expect.stringMatching(/^script-src-attr refused inline on \/overlay\/l\//)]);
});
