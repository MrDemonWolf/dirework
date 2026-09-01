# AGENTS.md

This file provides guidance for coding agents working on the Dirework codebase.

## Critical Documentation Reference

**ALWAYS update this section** when creating or discovering important docs to prevent context loss.

- Migration plan (Node/Postgres → Cloudflare) → `MIGRATION.md`
- Pre-migration audit (29 findings, all addressed in the port) → `AUDIT-cloudflare-migration.md`
- Database schemas → `packages/db/src/schema/` (index.ts, auth.ts, app.ts)
- Setup guides → `.env.example`, docs `apps/fumadocs/content/docs/deployment.mdx`

## Project Overview

Dirework is a Pomodoro timer and task list with Twitch chat integration for co-working
and body-doubling streams. Single-user per instance, one deploy per streamer. Runs
entirely on **Cloudflare Workers + D1** (free plan — no Durable Objects). Streamers login
with Twitch, connect a bot account, configure OBS overlays, and viewers interact via chat
commands.

## Architecture (Cloudflare)

Two workers + one D1 database, deployed via **Alchemy** (`packages/infra/alchemy.run.ts`):

- **`dirework`** (web) — Next.js 16 via OpenNext (`@opennextjs/cloudflare`). Dashboard,
  Theme Center, bot settings, overlays, bot console page.
- **`dirework-api`** (server) — Hono worker. Mounts better-auth (`/api/auth/*`), tRPC
  (`/trpc/*`), bot OAuth (`/api/bot/*`), `/health`.
- **`dirework-db`** — D1 (SQLite). Migrations in `packages/db/src/migrations`, applied by
  Alchemy on deploy.

**Same-origin proxy (load-bearing):** `*.workers.dev` is on the Public Suffix List, so
cookies cannot span the two workers. The web app's `next.config.ts` rewrites
`/rpc/:path*` → api `/trpc/:path*` (tRPC never redirects, so a rewrite is safe). The
OAuth routes `/api/auth/*` and `/api/bot/*` are proxied by **route handlers**
(`apps/web/src/app/api/{auth,bot}/**/route.ts` via `lib/auth-proxy.ts`,
`redirect: "manual"`) — a rewrite follows upstream 3xx internally and drops the
redirect's Set-Cookie, which silently breaks the OAuth callbacks. The browser only
ever sees the web origin for authenticated traffic (sameSite lax cookies). Public
token-authenticated traffic (overlay polling, bot page) goes DIRECT to the api worker via
`publicTrpc` (no cookies) to avoid double-hop request burn on the free tier.

**Per-request factories, no module singletons** (Workers isolate per request):
`createDb()` (packages/db), `createAuth()` (packages/auth), `createContext({ context })`
(packages/api). Never add module-level db/auth/EventEmitter state.

**Real-time = polling.** Overlays poll public tRPC queries every 3s and compute the
countdown locally from `targetEndTime`. There is no SSE, no event bus. (The
countdown is local, so the poll only catches state changes; the interval is kept
high to stay within the Cloudflare free-tier request budget.)

**Twitch bot = browser page.** `/bot/<token>` (token-gated, `instanceConfig.botToken`)
holds the IRC WebSocket (`wss://irc-ws.chat.twitch.tv`) via `apps/web/src/lib/irc-client.ts`,
relays `!`-prefixed chat to `bot.ingest` (stateless, runs command logic against D1), and
sends back the returned replies. Bot lives only while that page is open (OBS browser
source or pinned tab). Chat token comes from `bot.getSession` (server refreshes it; the
refresh token and client secret never reach the browser).

## Monorepo Structure

Turborepo + Bun workspaces (catalog for shared versions). All packages ESM.

```
apps/web           → Next.js 16 on Workers via OpenNext, port 3001 (dev)
apps/server        → Hono API worker, port 3000 (dev)
apps/fumadocs      → Fumadocs documentation site, port 4000 (GitHub Pages)
packages/api       → tRPC routers + services + bot command logic
packages/auth      → Better Auth (Twitch OAuth) — createAuth() factory
packages/db        → Drizzle ORM schema + createDb() (drizzle-orm/d1) + migrations
packages/env       → cloudflare:workers bindings (server), t3-env (web), dotenv proxy (local tooling)
packages/infra     → Alchemy IaC (both workers + D1)
packages/config    → Shared TypeScript configuration
```

## Commands

```bash
bun run dev           # Alchemy dev: api worker :3000 + web :3001 + local D1 (migrations applied)
bun run dev:web       # Web app only
bun run dev:server    # API worker only
bun run build         # Build all apps
bun run check-types   # TypeScript type checking across all packages
bun run test          # Vitest unit tests across all packages
bun run db:generate   # Generate a Drizzle migration from schema changes
bun run deploy        # Alchemy deploy (both workers + D1) — CI does this on main
bun run destroy       # Tear down the Cloudflare deployment
```

Local env lives in `packages/infra/.env` (+ mirrored `apps/server/.env`,
`apps/web/.env`); see `.env.example`.

## Tech Stack

- **Next.js 16** (App Router) with React 19, React Compiler, typed routes, OpenNext on Workers
- **Hono** API worker with `@hono/trpc-server`
- **tRPC v11** — `httpBatchLink` to same-origin `/rpc` (authed) + `publicTrpc` direct to the api worker (public)
- **TanStack React Query** (polling via `refetchInterval`)
- **Better Auth** with Twitch social provider (30-day sessions, sqlite adapter)
- **Drizzle ORM** on **Cloudflare D1** (`drizzle-orm/d1`, drizzle-kit `d1-http`)
- **Tailwind CSS v4** + shadcn/ui (base-lyra) + Lucide icons
- **Alchemy** infrastructure-as-code; **GitHub Actions** CI/CD
- **Fumadocs** with Orama search
- **TypeScript 5** strict everywhere; **Vitest** for tests

## Code Patterns

### Imports & Aliases

Web app: `@/` → `apps/web/src/`. Internal packages: `@dirework/api`, `@dirework/auth`,
`@dirework/db`, `@dirework/env`. Shared config types/constants come from
`@dirework/api/config-shared` — do NOT re-declare them in the web app (audit M3/M4).

### tRPC / API layer

Routers in `packages/api/src/routers/` (`user`, `task`, `timer`, `config`, `overlay`, `bot`).
`publicProcedure` (overlays + bot page, token-gated) vs `protectedProcedure` (session).

**Services own mutations** (`packages/api/src/services/`): `task-service`, `timer-service`,
`overlay-service`, `twitch-auth`, `tokens`, `singleton`, `provision`. Both tRPC routers and
`bot.ingest` call the same service functions — never duplicate mutation logic in a router
or command handler (audit M1). Pure logic (timer-logic.ts, config-shared.ts, services)
must not import `@dirework/env/server` — Vitest runs in Node and cannot resolve
`cloudflare:workers`.

Token gates: `verifyOverlayToken` / `verifyBotToken` (constant-time compare, bounded
zod inputs). Never return `accessToken`/`refreshToken` from any procedure (audit H1).

### Database

Schema split: `auth.ts` (Better Auth tables), `app.ts` (instanceConfig, botAccount, task,
timerState, timerConfig, timerStyle, taskStyle, botConfig), `index.ts` (relations).
SQLite idioms: booleans `integer({mode:"boolean"})`, timestamps `integer({mode:"timestamp_ms"})`
with `unixepoch('subsecond')*1000` defaults, JSON columns `text({mode:"json"}).$type<T>()`
(commandAliases, scopes), opacities `real`, cuid2 ids. Config rows are singletons
(`SINGLETON_ID`), lazily provisioned; all columns have defaults. The API maps flat DB
columns ↔ nested config objects via build/flatten helpers in
`packages/api/src/config-shared.ts`.

Migrations: `bun run db:generate` → SQL in `packages/db/src/migrations` → applied by
Alchemy (dev and deploy). Never edit applied migrations.

### Authentication

- Better Auth on the api worker; browser reaches it through the web origin proxy.
  `baseURL` = web origin. Cookies sameSite lax/secure/httpOnly. First user to sign in
  claims the instance (`isOwner`); config singletons provisioned on session create.
- Bot account connection = separate OAuth flow on Hono: `/api/bot/authorize` →
  `/api/bot/callback/twitch` (state cookie, scopes `user:read:chat user:write:chat`,
  error reasons surfaced as `?bot=error&reason=…` toasts).
- Server components check sessions via `lib/server-session.ts` (`getServerSession()` —
  forwards cookies to the api worker). Never import `@dirework/auth` or `@dirework/db`
  in apps/web.

### Overlay System

Public routes `/overlay/t/[token]` (timer) and `/overlay/l/[token]` (tasks), transparent
for OBS. Poll `publicTrpc.overlay.getTimerState` / `getTaskList` every 3s
(`refetchIntervalInBackground: true`); timer display ticks locally (100ms) from
`targetEndTime`. React Query keeps the last payload on failed refetches so OBS sources
don't blank. Two ring shapes: circle + rounded-rect squircle.

### Theme Center & Frontend

Design language: **"Focus Console"** — dark-first instrument panel. Montserrat (display,
tabular-nums timer digits), IBM Plex Sans (body), IBM Plex Mono (labels/tokens/status).
Warm charcoal base, teal accent used sparingly (Twitch purple reserved for the
Twitch sign-in/connect buttons), amber = paused, emerald =
live/connected (LED-style chips). All animation respects `prefers-reduced-motion`;
inputs ≥16px on touch (iOS zoom). Destructive actions (token regenerate, disconnect,
clear, stop) always confirm via the AlertDialog primitive. Editors with dirty state use
the unsaved-changes guard hook. 6 theme presets in `lib/theme-presets.ts`.

### Hydration Safety

Mounted-state pattern for client-only values (next-themes); controlled props on Base UI
Switch placeholders pre-mount; `suppressHydrationWarning` on time-of-day greeting.

## Testing

Vitest across `packages/api`, `packages/auth`, `apps/web` — run `bun run test`.
Key suites: `packages/api/src/services/__tests__/` (tokens, timer-service, task-service),
`packages/api/src/routers/__tests__/` (timer-logic, config build/flatten/round-trip),
`apps/web/src/lib/__tests__/` (timer-utils, task-utils, theme-presets, config-types),
`packages/auth/src/__tests__/has-owner.test.ts`.
New pure functions → extract to testable modules + add tests.

## CI/CD

**All actions are SHA-pinned** (with a trailing `# vN` comment); Dependabot moves the
pins. Every workflow declares minimal `permissions`.

- `.github/workflows/verify.yml` — **the single verification pipeline**
  (install → lint → check-types → test:coverage → build), called via `workflow_call`.
  CI and deploy both use it, so the deploy gate cannot drift from the PR gate.
- `.github/workflows/ci.yml` — push (dev/main) + PRs: calls `verify.yml`, plus a
  `dependency-review` job on PRs.
- `.github/workflows/deploy.yml` — push to main (or manual): `verify.yml` **including the
  build**, then validates required secrets/vars, then Alchemy deploy.
  **Deploy runs under Node via the lockfile-pinned local `tsx`
  (`node ./node_modules/.bin/tsx`) — Bun segfaults on the Alchemy program** (same lesson
  as Wolfathon). Secrets: `CLOUDFLARE_API_TOKEN`, `ALCHEMY_PASSWORD`,
  `ALCHEMY_STATE_TOKEN` (**shared fleet token** — auths the shared account-wide
  `alchemy-state` store worker), `BETTER_AUTH_SECRET`, `TWITCH_CLIENT_ID`,
  `TWITCH_CLIENT_SECRET`. Repository **variables**: `BETTER_AUTH_URL`, `CORS_ORIGIN`.
  **`NEXT_PUBLIC_SERVER_URL` is NOT a deploy variable** — Alchemy injects the api
  worker's resolved URL at build and runtime.
- `.github/workflows/deploy-docs-to-pages.yml` — fumadocs static export → GitHub Pages.

## Deployment

Production: `dirework.mrdemonwolf.workers.dev` (web) + `dirework-api.mrdemonwolf.workers.dev`
(api) + `dirework-db` (D1). Twitch app redirect URLs point at the WEB origin:
`/api/auth/callback/twitch` and `/api/bot/callback/twitch`. Docs:
`apps/fumadocs/content/docs/deployment.mdx`.

## Git Workflow

- `main` — production (deploys on push)
- `dev` — development branch; PR to `main` for releases

## Environment Variables

Server worker bindings (typed via `packages/env/env.d.ts` from `alchemy.run.ts`):
`DB` (D1), the four rate-limit bindings (`RL_AUTH`, `RL_BOT`, `RL_TOKEN`, `RL_OVERLAY`),
`CORS_ORIGIN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TWITCH_CLIENT_ID`,
`TWITCH_CLIENT_SECRET`, `DOCS_URL`, plus dev-only `DEV_LOGIN` (gates the Twitch-less
`POST /api/auth/dev-login` owner-session bypass — never set in production).
Web worker: `NEXT_PUBLIC_SERVER_URL`.
`SKIP_ENV_VALIDATION=true` bypasses t3-env during CI/build.

## Footer Convention

Both the web app and docs site use the same footer format:
`© {year} DireWork by MrDemonWolf, Inc.` — both names are links (no underline,
font-medium, hover highlight). "DireWork" → GitHub repo, "MrDemonWolf, Inc." →
mrdemonwolf.com.

- Web app: inline in `apps/web/src/app/(app)/layout.tsx`
- Docs: shared `Footer` component in `apps/fumadocs/src/components/footer.tsx`

## README Convention

The README follows the MrDemonWolf format (see `mrdemonwolf/fluffboost` for reference).
Section order: Title with tagline, Description, Features, Getting Started, Usage, Tech
Stack, Development (Prerequisites, Setup, Scripts, Code Quality), Deployment, Project
Structure, License badge, Contact, Footer. No emojis. Bold feature names. Aligned tables.
Code blocks with language tags.
