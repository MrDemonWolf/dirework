import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Reuse the isolated local workers and fresh synthetic D1 database, never a live instance.
export default defineConfig({
  ...base,
  testDir: "./screenshots",
  retries: 0,
  projects: [
    {
      name: "marketing",
      use: {
        viewport: { width: 1440, height: 1000 },
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
  ],
});
