// Run this program under Node (tsx), never Bun — Bun segfaults executing the
// Alchemy program (same failure as Wolfathon). The package scripts and
// deploy.yml both invoke it via tsx directly, bypassing the alchemy CLI's
// runtime detection (which picks bun whenever bun is the package manager).
import alchemy from "alchemy";
import { D1Database, Nextjs, RateLimit, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

// CI runners are ephemeral — the default local-file state store would lose
// Alchemy's record of already-created resources between deploys, causing it
// to try (and fail) to recreate them. In CI we persist state in a dedicated
// CloudflareStateStore worker, `alchemy-state-dirework`, backed by a SQLite
// Durable Object (free-tier eligible since Sept 2024). Each MrDemonWolf app
// runs its OWN state worker with its OWN token (the website project does the
// same with `alchemy-state-mrdemonwolf`) — a per-project worker avoids the
// token clash you'd get sharing the default account-wide `alchemy-state-service`.
// So ALCHEMY_STATE_TOKEN here is dirework's own, independent of the other apps.
// Only used in CI: it hits the Cloudflare API, so local `bun run dev` (no CF
// auth) falls back to the default filesystem state store, which persists fine
// across local runs.
const app = await alchemy("dirework", {
  stateStore: process.env.CI
    ? (scope) =>
        new CloudflareStateStore(scope, {
          scriptName: "alchemy-state-dirework",
          stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN),
        })
    : undefined,
});

const db = await D1Database("database", {
  name: "dirework-db",
  migrationsDir: "../../packages/db/src/migrations",
  adopt: true,
});

// Rate-limit bindings (P1.8). Cloudflare's rate limiter is per-namespace and
// per-colo; `period` may only be 10 or 60 seconds. Namespace ids must be stable
// and unique per binding — changing one resets its counters.
//
// Limits are sized for a SINGLE streamer's instance: the dashboard is used by
// one person, the bot page is one browser tab, and overlays poll on a fixed 3s
// interval. They exist to blunt brute-force and scripted abuse of the public
// token-gated routes, not to shape legitimate traffic.
const authRateLimit = RateLimit({
  // Login + OAuth callbacks. One human signing in; anything faster is scripted.
  namespace_id: 1001,
  simple: { limit: 20, period: 60 },
});

const botRateLimit = RateLimit({
  // bot.getSession bootstrap + bot.ingest. Chat can burst, so this is generous
  // but still far below what a flood would need.
  namespace_id: 1002,
  simple: { limit: 300, period: 60 },
});

const tokenVerifyRateLimit = RateLimit({
  // Guards token-gated entry points against enumeration of the 32-char secrets.
  namespace_id: 1003,
  simple: { limit: 60, period: 60 },
});

const overlayRateLimit = RateLimit({
  // Overlays poll every 3s → ~20 req/min per source, two sources per streamer.
  // Deliberately separate (and higher) so overlay polling can never be starved
  // by traffic hitting the other buckets.
  namespace_id: 1004,
  simple: { limit: 120, period: 60 },
});

// API worker: dirework-api.<account>.workers.dev
// Serves better-auth (/api/auth/*), tRPC (/trpc/*), and bot OAuth routes.
export const server = await Worker("server", {
  name: "dirework-api",
  // First deploy against an empty state store re-adopts the live worker
  // instead of trying to create over it.
  adopt: true,
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  url: true,
  bindings: {
    DB: db,
    RL_AUTH: authRateLimit,
    RL_BOT: botRateLimit,
    RL_TOKEN: tokenVerifyRateLimit,
    RL_OVERLAY: overlayRateLimit,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    TWITCH_CLIENT_ID: alchemy.env.TWITCH_CLIENT_ID!,
    TWITCH_CLIENT_SECRET: alchemy.secret.env.TWITCH_CLIENT_SECRET!,
    DOCS_URL: process.env.DOCS_URL ?? "https://mrdemonwolf.github.io/dirework",
    // DEV ONLY — enables the POST /api/auth/dev-login bypass. Plain process.env
    // (alchemy.env would throw on unset); defaults "false" so prod, which never
    // sets it, keeps the endpoint unregistered. Never add to deploy secrets.
    DEV_LOGIN: process.env.DEV_LOGIN ?? "false",
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
  adopt: true, // re-adopt live worker on first deploy against an empty state store
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
  // NEXT_PUBLIC_DEV_LOGIN bakes at build (client component reads it inlined) —
  // defaults "" so the dev-bypass button stays hidden in prod builds. Local dev
  // reads it from apps/web/.env instead.
  build: `NEXT_PUBLIC_SERVER_URL=${server.url} NEXT_PUBLIC_DEV_LOGIN=${process.env.NEXT_PUBLIC_DEV_LOGIN ?? ""} bun run opennextjs-cloudflare build && node scripts/fix-duplicate-wasm-specifiers.mjs`,
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
