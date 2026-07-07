// Run this program under Node (tsx), never Bun — Bun segfaults executing the
// Alchemy program (same failure as Wolfathon). The package scripts and
// deploy.yml both invoke it via tsx directly, bypassing the alchemy CLI's
// runtime detection (which picks bun whenever bun is the package manager).
import alchemy from "alchemy";
import { D1Database, Nextjs, Worker } from "alchemy/cloudflare";
import { D1StateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

// CI runners are ephemeral — the default local-file state store would lose
// Alchemy's record of already-created resources between deploys, causing it
// to try (and fail) to recreate them. D1StateStore persists state in its own
// small D1 database instead, which is free-tier compatible (no Durable
// Objects, unlike CloudflareStateStore).
const app = await alchemy("dirework", {
  stateStore: (scope) => new D1StateStore(scope),
});

const db = await D1Database("database", {
  name: "dirework-db",
  migrationsDir: "../../packages/db/src/migrations",
  adopt: true,
});

// API worker: dirework-api.<account>.workers.dev
// Serves better-auth (/api/auth/*), tRPC (/trpc/*), and bot OAuth routes.
export const server = await Worker("server", {
  name: "dirework-api",
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  url: true,
  bindings: {
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    TWITCH_CLIENT_ID: alchemy.env.TWITCH_CLIENT_ID!,
    TWITCH_CLIENT_SECRET: alchemy.secret.env.TWITCH_CLIENT_SECRET!,
    DOCS_URL: process.env.DOCS_URL ?? "https://mrdemonwolf.github.io/dirework",
  },
  dev: {
    port: 3000,
  },
});

// Web worker: dirework.<account>.workers.dev
// Next.js dashboard + overlays + bot page. Auth/tRPC proxied same-origin to the
// API worker — /rpc via next.config rewrite, /api/auth + /api/bot via route
// handlers (workers.dev is on the Public Suffix List, so cookies cannot span
// the two workers).
export const web = await Nextjs("web", {
  name: "dirework",
  cwd: "../../apps/web",
  // OpenNext's build inlines next/og (used by opengraph-image.tsx), which
  // imports its .wasm deps under two different specifiers ("foo.wasm" and
  // "foo.wasm?module") for the same file. Alchemy's own esbuild pass dedupes
  // wasm modules by that raw specifier string, so it uploads the same wasm
  // twice under one name — Cloudflare then rejects the worker upload with a
  // vague "Uncaught Error: internal error" (10021). Normalize the specifiers
  // to one form right after OpenNext's build so Alchemy's dedup collapses
  // them naturally, then let Alchemy bundle as usual.
  // The /rpc rewrite target and the /api/auth|/api/bot proxy handlers bake
  // NEXT_PUBLIC_SERVER_URL at BUILD time; the runtime binding below is too
  // late. The deploy job env var can be empty (unset GH repo var), so inject
  // the api URL Alchemy already resolved and never depend on a GH variable.
  build: `NEXT_PUBLIC_SERVER_URL=${server.url} bun run opennextjs-cloudflare build && node scripts/fix-duplicate-wasm-specifiers.mjs`,
  bundle: {
    minify: true,
    // Alchemy's own esbuild pass over the OpenNext output has no loader for
    // next/og's compiled default font (Geist-Regular.ttf.bin, pulled in by
    // apps/web/src/app/opengraph-image.tsx) — add it, keeping Alchemy's
    // required defaults for the rest.
    loader: {
      ".js": "jsx",
      ".mjs": "jsx",
      ".cjs": "jsx",
      ".sql": "text",
      ".bin": "binary",
    },
  },
  bindings: {
    NEXT_PUBLIC_SERVER_URL: server.url!,
    // Read by the web worker via process.env (OpenNext surfaces bindings there):
    // metadataBase in app/layout.tsx and the footer legal links in (app)/layout.tsx.
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    // Optional — plain process.env (alchemy.env throws on unset); "" reads as
    // falsy so the footer legal links stay hidden when the operator omits them.
    PRIVACY_POLICY_URL: process.env.PRIVACY_POLICY_URL ?? "",
    TERMS_OF_SERVICE_URL: process.env.TERMS_OF_SERVICE_URL ?? "",
  },
  dev: {
    env: {
      PORT: "3001",
    },
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
