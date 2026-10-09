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
      // Ratchets just under the measured values: an honest global floor plus a
      // stricter bar for the unit-tested middleware in src/lib.
      thresholds: {
        statements: 39,
        branches: 68,
        functions: 46,
        lines: 36,
        "src/lib/**": { statements: 85, branches: 92, functions: 84, lines: 87 },
      },
    },
  },
});
