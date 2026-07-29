import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      thresholds: { statements: 70, branches: 85, functions: 65, lines: 70 },
    },
  },
});
