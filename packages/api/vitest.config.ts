import { defineConfig } from "vitest/config";

// decodeURIComponent because a file: URL percent-encodes spaces in the path.
const stubPath = decodeURIComponent(
  new URL("./src/__tests__/stubs/cloudflare-workers.ts", import.meta.url).pathname,
);

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    // Stub files live under __tests__ but are helpers, not suites.
    exclude: ["src/**/__tests__/stubs/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Measure every source file, not just the ones a test happens to import,
      // so an untested new module lowers the number instead of hiding.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "**/*.d.ts"],
      // Ratchets just under the measured values: an honest global floor plus a
      // stricter bar for the services and shared validation that own mutations.
      thresholds: {
        statements: 55,
        branches: 65,
        functions: 59,
        lines: 55,
        "src/services/**": { statements: 83, branches: 74, functions: 77, lines: 84 },
        "src/config-shared.ts": { statements: 89, branches: 94, functions: 88, lines: 89 },
      },
    },
  },
  resolve: {
    alias: {
      // Node can't resolve the Workers runtime module; the stub lets the real
      // appRouter (via bot.ts → @dirework/env/server) load under Vitest so
      // procedures can be tested through createCaller.
      "cloudflare:workers": stubPath,
    },
  },
});
