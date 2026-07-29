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
      thresholds: { statements: 50, branches: 60, functions: 55, lines: 50 },
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
