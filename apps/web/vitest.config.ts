import { defineConfig } from "vitest/config";
import path from "node:path";

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
      // Ratchets about five points under the measured values (36% statements,
      // 32% branches, 21% functions, 35% lines) so coverage can't silently
      // regress. Raise them when real coverage rises; never lower to go green.
      // The global floor is honest (most of the UI is untested); the modules
      // that ARE unit-tested keep a strict per-glob bar.
      thresholds: {
        statements: 31,
        branches: 27,
        functions: 16,
        lines: 30,
        "src/lib/{rate-limiter,theme-presets}.ts": {
          statements: 90,
          branches: 85,
          functions: 100,
          lines: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
