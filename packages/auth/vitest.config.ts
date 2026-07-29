import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    env: {
      SKIP_ENV_VALIDATION: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Low by design: most of this package is better-auth wiring that only
      // runs against a real Workers/D1 runtime. The ratchet still catches a
      // regression in the parts that ARE unit-testable (hasOwner, dev-login).
      thresholds: { statements: 15, branches: 15, functions: 20, lines: 15 },
    },
  },
});
