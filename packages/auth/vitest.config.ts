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
    env: {
      SKIP_ENV_VALIDATION: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Measure every source file, not just the ones a test happens to import,
      // so an untested new module lowers the number instead of hiding.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "**/*.d.ts"],
      // Ratchet just below the measured numbers (96% stmts, 95% lines, 89%
      // branches, 100% functions): create-auth.test.ts drives the real createAuth() over
      // sql.js, so the better-auth wiring is covered too. Raise these when
      // coverage rises; a drop means new code shipped without tests.
      thresholds: { statements: 95, branches: 85, functions: 95, lines: 94 },
    },
  },
  resolve: {
    alias: {
      // Node can't resolve the Workers runtime module; the stub lets the real
      // createAuth (via @dirework/env/server) load under Vitest.
      "cloudflare:workers": stubPath,
    },
  },
});
