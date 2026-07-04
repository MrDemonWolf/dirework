import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
config();

const runtimeEnv = typeof process === "undefined" ? {} : process.env;

// Local/tooling fallback (drizzle-kit, tests, scripts) — mirrors the Env shape
// without requiring the cloudflare:workers module.
export const env = new Proxy({} as Env, {
  get(_target, prop) {
    if (typeof prop !== "string") {
      return undefined;
    }

    return runtimeEnv[prop];
  },
});
