import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["deploy-config.ts"],
      thresholds: { statements: 95, branches: 90, functions: 100, lines: 95 },
    },
  },
});
