import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Only the two pure modules unit tests drive. The schema files are
      // declarative drizzle tables (no code path of their own runs) and index.ts
      // is the D1 factory, which needs the Workers binding; both would only
      // dilute the number. The migrations are tested in src/migrations/__tests__.
      include: ["src/defaults.ts", "src/provision.ts"],
      // Measured at 100% across the board; the floors sit five points under so a
      // new untested branch fails here instead of hiding. Never lower to go green.
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
