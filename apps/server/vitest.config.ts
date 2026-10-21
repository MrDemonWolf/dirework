import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Measure every source file, not just the ones a test happens to import,
      // so an untested new module lowers the number instead of hiding.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "**/*.d.ts"],
      // Ratchets about five points under the measured values (86% statements,
      // 94% branches, 81% functions, 87% lines): an honest global floor plus a
      // stricter bar for the unit-tested middleware in src/lib. Raise them when
      // coverage rises; never lower them to go green.
      thresholds: {
        statements: 80,
        branches: 88,
        functions: 76,
        lines: 82,
        "src/lib/**": { statements: 85, branches: 92, functions: 84, lines: 87 },
      },
    },
  },
});
