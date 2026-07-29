# CLAUDE.md

This file provides guidance for Claude Code when working on the Dirework codebase.

## Critical Documentation Reference

**ALWAYS update this section** when creating or discovering important docs to prevent context loss.

- Migration plan (Node/Postgres → Cloudflare) → `MIGRATION.md`
- Pre-migration audit (29 findings, all addressed in the port) → `AUDIT-cloudflare-migration.md`
- Database schemas → `packages/db/src/schema/` (index.ts, auth.ts, app.ts)
- Setup guides → `.env.example`, docs `apps/fumadocs/content/docs/deployment.mdx`
- Contributor setup + branch/PR workflow → `CONTRIBUTING.md`
- Design system (tokens + component specs) → `design-system/`, docs `apps/fumadocs/content/docs/design-system.mdx`

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
refresh token and client secret never reach the browser). Outbound replies are throttled
by a rolling token bucket (`apps/web/src/lib/rate-limiter.ts`: 20 msgs/30s + ≥1s gap,
bounded queue) — never a fixed spacer. The page revalidates the chat token hourly
(`getSession({ revalidate: true })` → Twitch `/oauth2/validate`) and bounds the
auth-failure recovery loop.

**Command aliases** are stored **canonically without a leading `!`** (`{ t: "task" }`).
`normalizeAliases` / `normalizeAliasToken` + `KNOWN_ALIAS_TARGETS` in
`packages/api/src/config-shared.ts` are the single source shared by the chat resolver
(`resolveAlias`), the `commandAliasesInput` schema, and the dashboard editor — they accept
either form and reject empty/duplicate/recursive/unknown targets. (Fixes the old `!!task`
bug where the UI stored `!t → !task` and the resolver re-prefixed `!`.)

**API request logging** uses a structured, redacted middleware
(`apps/server/src/lib/logger.ts`), NOT `hono/logger`: it logs only
`{ id, method, path, status, ms }` with the query string stripped, so OAuth codes/state
and tokens can never reach logs. It also stamps an `x-request-id` response header.

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
packages/overlay-kit → pure overlay geometry (squircle path) + clock formatting shared by web overlays and docs mocks; zero runtime deps
packages/config    → Shared TypeScript configuration
```

## Commands

```bash
bun run dev           # Alchemy dev: api worker :3000 + web :3001 + local D1 (migrations applied) + docs :4000
bun run dev:web       # Web app only (standalone Next dev :3001; API comes from `bun run dev` or a deployed origin)
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
Three tiers: `publicProcedure` (overlays + bot page, token-gated),
`protectedProcedure` (valid session), and **`ownerProcedure`** (session AND
`user.isOwner`, fails closed with FORBIDDEN). Every dashboard/config/task/timer/
token/bot-account procedure uses `ownerProcedure` — being signed in is not
authorization. Only genuinely public, token-gated procedures stay
`publicProcedure`.

**Task mutations are atomic.** `activateTask` / `markTaskDone` run their
multi-step work in ONE `db.batch` (atomic on D1), `promoteNextPending` is a
single guarded UPDATE with a subquery, and a **partial unique index**
(`task_one_active_per_author_idx`) makes "≤1 active task per Twitch user" a DB
invariant. `createTask` catches the resulting UNIQUE violation and falls back to
`pending` rather than dropping the chat message. Bot ingest is serialized
client-side (a promise chain in `bot-console.tsx`) so chat commands apply in
order. List ordering tiebreaks on `id` so concurrent creates sort deterministically.

**Services own mutations** (`packages/api/src/services/`): `task-service`, `timer-service`,
`overlay-service`, `twitch-auth`, `tokens`, `singleton`, `provision`. Both tRPC routers and
`bot.ingest` call the same service functions — never duplicate mutation logic in a router
or command handler (audit M1). Pure logic (timer-logic.ts, config-shared.ts, services)
must not import `@dirework/env/server` — Vitest runs in Node and cannot resolve
`cloudflare:workers`.

**Validation is centralized** in `config-shared.ts`: `cssColorSchema`,
`cssLengthSchema`, `fontFamilySchema`, `opacitySchema`, `chatMessageSchema`.
The CSS ones are **allowlists, not length caps** — style values are interpolated
into overlay CSS, so `;`/`{}`/`url()` must never survive validation. Chat
messages are bounded by **UTF-8 bytes** (`truncateToBytes`, `MAX_CHAT_BYTES`),
never characters — an IRC line caps at 512 bytes, so 500 emoji would overflow it.

**Abuse protections:** Cloudflare rate-limit bindings (`RL_AUTH`, `RL_BOT`,
`RL_TOKEN`, `RL_OVERLAY` — separate buckets so a flood on one can't starve
overlay polling) applied in `apps/server/src/lib/rate-limit.ts`; a global
`bodyLimit`; streamed (not buffered) proxy bodies with a 413 pre-check in
`auth-proxy.ts`; and `AbortSignal.timeout` on every outbound Twitch fetch. The
limiter **fails open** if a binding is absent — it's a brake, not a dependency.

Token gates: `verifyOverlayToken` / `verifyBotToken` (constant-time compare, bounded
zod inputs). Never return `accessToken`/`refreshToken` from any procedure (audit H1).

### Database

Schema split: `auth.ts` (Better Auth tables), `app.ts` (instanceConfig, botAccount, task,
timerState, timerConfig, timerStyle, taskStyle, botConfig), `index.ts` (relations).
SQLite idioms: booleans `integer({mode:"boolean"})`, timestamps `integer({mode:"timestamp_ms"})`
with `unixepoch('subsecond')*1000` defaults, JSON columns `text({mode:"json"}).$type<T>()`
(commandAliases, scopes), opacities `real`, cuid2 ids. Config rows are singletons
(`SINGLETON_ID`), lazily provisioned; all columns have defaults. `botAccount` carries a
nullable `refreshLockedUntil` lease that serializes concurrent Twitch OAuth refreshes
(P0.5 — Twitch invalidates the old refresh token on rotation). The API maps flat DB
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
don't blank. Two ring shapes: circle + rounded-rect squircle. The timer is drawn at a
fixed pixel size (`config.dimensions`) wrapped in `<AutoScale>` (`components/auto-scale.tsx`),
which uses a ResizeObserver to scale it up/down to fill the OBS browser source while
preserving aspect ratio. While idle the overlay renders a full preview (configured work
length + full ring) instead of blanking, so streamers can position it during setup.
Recommended OBS source sizes: 320×320 timer, 360×720 tasks.

### Theme Center & Frontend

Design language: **"Focus Console"** — dark-first instrument panel. Montserrat (display,
tabular-nums timer digits), IBM Plex Sans (body), IBM Plex Mono (labels/tokens/status).
Warm charcoal base, teal accent used sparingly (Twitch purple reserved for the
Twitch sign-in/connect buttons), amber = paused, emerald =
live/connected (LED-style chips). All animation respects `prefers-reduced-motion`;
inputs ≥16px on touch (iOS zoom). Destructive actions (token regenerate, disconnect,
clear, stop) always confirm via the AlertDialog primitive. Editors with dirty state use
the unsaved-changes guard hook. 6 theme presets in `lib/theme-presets.ts`.

### Reuse, libraries & UI workflow

DRY is not just the API layer. Before writing a new web component or helper, grep for an
existing home and reuse it:

- **UI primitives** — `apps/web/src/components/ui/` (button, card, alert-dialog, input,
  label, select, tabs, tooltip, switch, slider, dropdown-menu, collapsible, skeleton,
  sonner). Reuse these instead of hand-rolling markup; add a primitive here when a pattern
  repeats (e.g. a destructive callout) rather than copy-pasting it.
- **Shared components** — `confirm-dialog`, `save-bar`, `status-chip`, `timer-status-badge`,
  `unsaved-changes-guard`, `auto-scale`, `loader`.
- **Lib helpers** — `lib/utils.ts` (`cn`), `timer-utils` (`resolvePhaseDuration`,
  ms-from-state), `task-utils` (`groupTasksByAuthor`), `status-tones`, `config-types`;
  overlay geometry/formatting in `@dirework/overlay-kit`.
- **Constants** — timer/config defaults come from `@dirework/db/defaults` (re-exported via
  `@dirework/api/config-shared`); never re-type `25*60*1000` etc. The M1/M3/M4 "don't
  duplicate" rules apply to the web component layer too, not only services/config.

Skills to use (they exist globally, not in-repo):

- **`/frontend-design`** — invoke when building new UI, so components are distinctive and
  production-grade, not generic.
- **`/uiux-review`** — run before shipping any UI change (NN/g heuristics, accessibility,
  visual hierarchy).

Libraries: prefer a good, well-maintained library over a hand-rolled solution when it
genuinely fits — don't reinvent. But climb the ladder first: platform/stdlib → an
already-installed dependency (see the `catalog` in root `package.json`) → a new library.
Skip adding a dependency only when a few lines clearly beat it. New shared version pins go
in the workspace catalog.

### Hydration Safety

Mounted-state pattern for client-only values (next-themes); controlled props on Base UI
Switch placeholders pre-mount; `suppressHydrationWarning` on time-of-day greeting.

## Testing

Vitest across `packages/api`, `packages/auth`, `apps/web`, `apps/server` — run
`bun run test`.
Key suites: `packages/api/src/services/__tests__/` (tokens, timer-service, task-service,
twitch-auth), `packages/api/src/routers/__tests__/` (timer-logic, config build/flatten/
round-trip, aliases), `apps/web/src/lib/__tests__/` (timer-utils, task-utils, theme-presets,
config-types, rate-limiter), `apps/server/src/lib/__tests__/` (logger redaction),
`packages/auth/src/__tests__/has-owner.test.ts`.
`packages/api/src/__tests__/app-router.test.ts` drives the REAL `appRouter` via
`createCaller` (auth, owner authorization, validation, DB effects, error
mapping). This works because `packages/api/vitest.config.ts` aliases
`cloudflare:workers` to a stub — without it, any chain touching
`@dirework/env/server` can't load under Node and router tests degrade into
schema-only checks.
New pure functions → extract to testable modules + add tests. **Never assert on
an object literal the test itself constructed** — that passes with the
implementation deleted; drive the real function instead.

## CI/CD

- `.github/workflows/ci.yml` — push (dev/main) + PRs: install → check-types → build → test.
  `SKIP_ENV_VALIDATION=true`, dummy `NEXT_PUBLIC_SERVER_URL`.
- `.github/workflows/deploy.yml` — push to main (or manual): test job, then Alchemy deploy.
  **Deploy runs under Node via `npx tsx` — Bun segfaults on the Alchemy program** (same
  lesson as Wolfathon). Secrets: `CLOUDFLARE_API_TOKEN`, `ALCHEMY_PASSWORD`,
  `ALCHEMY_STATE_TOKEN` (shared fleet token — auths the shared account-wide `alchemy-state` store worker),
  `BETTER_AUTH_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`. URLs
  (`BETTER_AUTH_URL`, `CORS_ORIGIN`, `NEXT_PUBLIC_SERVER_URL`) are GitHub repository
  **variables**, read by the deploy job via `${{ vars.* }}` (not workflow literals).
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
`DB` (D1), `CORS_ORIGIN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TWITCH_CLIENT_ID`,
`TWITCH_CLIENT_SECRET`, `DOCS_URL`, plus dev-only `DEV_LOGIN` (gates the Twitch-less
`POST /api/auth/dev-login` owner-session bypass — never set in production). Web worker:
`NEXT_PUBLIC_SERVER_URL`, `BETTER_AUTH_URL`, optional `PRIVACY_POLICY_URL` /
`TERMS_OF_SERVICE_URL`, and build-time `NEXT_PUBLIC_DEV_LOGIN` (shows the dev-bypass button).
Deploy needs a sixth GitHub secret, `ALCHEMY_STATE_TOKEN` (see CI/CD).
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
