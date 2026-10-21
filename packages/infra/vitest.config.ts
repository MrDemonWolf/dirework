import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // The pure modules unit tests drive: deploy constants, the smoke assertions
      // and the post-cutover D1 housekeeping. alchemy.run.ts and the CLI
      // entrypoints talk to Cloudflare, so the deploy itself exercises them.
      include: ["deploy-config.ts", "post-deploy.ts", "smoke.ts"],
      thresholds: { statements: 95, branches: 90, functions: 100, lines: 95 },
    },
  },
});
