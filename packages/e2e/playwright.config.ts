import { defineConfig, devices } from "@playwright/test";

import { API_HEALTH_URL, WEB_HEALTH_URL, WEB_ORIGIN } from "./src/env";

/**
 * Browser end-to-end tests against the real stack: the api worker from source and the web
 * worker from its built bundle, both in local workerd, over a fresh local D1 with every
 * migration applied (src/boot-api.ts, src/boot-web.ts). Signed in through the DEV_LOGIN
 * bypass. One worker and serial specs: a single-owner instance and one shared database.
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun src/boot-api.ts",
      url: API_HEALTH_URL,
      timeout: 180_000,
      // Never adopt a `bun run dev` already on these ports: its DEV_LOGIN secret differs.
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun src/boot-web.ts",
      url: WEB_HEALTH_URL,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
