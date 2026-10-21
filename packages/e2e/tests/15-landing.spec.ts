import { expect, test } from "@playwright/test";

import { WEB_ORIGIN } from "../src/env";

// The home page of a claimed instance (00-first-run claimed it) as a signed-out visitor sees
// it: a static viewer landing that points at deploying your own copy.

test("a refused sign-in shows the claimed notice with a link to deploy your own", async ({
  page,
}) => {
  await page.goto("/?error=instance_claimed");

  // Filtered by its text: Next's route announcer is an (empty) alert too.
  const notice = page
    .getByRole("alert")
    .filter({ hasText: "already belongs to a different Twitch account" });
  await expect(notice).toBeVisible();
  const deploy = notice.getByRole("link", { name: /Deploy your own/ });
  await expect(deploy).toHaveAttribute("href", /\/docs\/deployment$/);

  // The code is stripped from the address bar so a refresh doesn't re-show the notice.
  await expect(page).toHaveURL(`${WEB_ORIGIN}/`);
});

test("Deploy your own points at the deployment docs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deploy your own", exact: true })).toHaveAttribute(
    "href",
    /^https:\/\/.+\/docs\/deployment$/,
  );
  await expect(page.getByRole("link", { name: "Read the docs" })).toHaveAttribute(
    "href",
    /^https:\/\/.+\/docs$/,
  );
  await expect(page.getByRole("button", { name: "Sign in with Twitch" })).toBeVisible();
});

test("the landing page makes no tRPC requests", async ({ page }) => {
  const rpc: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/rpc") || pathname.startsWith("/trpc")) rpc.push(pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(rpc).toEqual([]);
});
