// This package ships font files, not code: its tests guard the files and the apps that load
// them, so `test:coverage` runs them without a coverage report (there is no source to measure)
// and CI's coverage pipeline still executes them.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
