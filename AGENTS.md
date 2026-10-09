# AGENTS.md

This file provides guidance for coding agents working on the Dirework codebase.

## Critical Documentation Reference

**ALWAYS update this section** when creating or discovering important docs to prevent context loss.

- Node/Postgres → Cloudflare migration (completed; historical record) → `MIGRATION.md`
- Pre-migration audit (29 findings, all addressed in the port) → `AUDIT-cloudflare-migration.md`
- Security policy and production operator checklist → `SECURITY.md`
- Marketing website research and UI/UX review → `MARKETING-REVIEW.md`
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

**Same-origin proxy (load-bearing):** auth cookies are host-only on the web origin (no
cross-subdomain cookies), so they never reach the api worker directly. Note that
`workers.dev` is a public suffix, so every worker under `<account>.workers.dev` is
**same-site**: SameSite=Lax is not a CSRF boundary between them. The api worker's
`/trpc/*` JSON-only guard (`apps/server/src/lib/require-json.ts`, 415 otherwise) is — it
forces a CORS preflight that only the web origin passes. **Every** web→api hop is a
**route handler**, never a `next.config` rewrite: `/rpc/*` → api `/trpc/*`
(`apps/web/src/app/rpc/[...path]/route.ts`, `proxyRpcToApi`) and the OAuth routes
`/api/auth/*`, `/api/bot/*` (`apps/web/src/app/api/{auth,bot}/**/route.ts`, `proxyToApi`),
all via `lib/auth-proxy.ts` (streamed bodies, `redirect: "manual"`). A rewrite follows
upstream 3xx internally and drops the redirect's Set-Cookie (silently breaking the OAuth
callbacks), and it cannot add per-request headers — which the proxy must:
**signed client IP.** On the web→api hop the api worker's CF-Connecting-IP is the web
worker's egress, so the proxy (and the SSR fetches in `lib/server-session.ts`, via
`stampForwardedClient`) forwards the browser's own CF-Connecting-IP in
`x-dirework-client-ip` plus `x-dirework-client-ip-sig` = HMAC-SHA256 under
`PROXY_SECRET` (`@dirework/api/proxy-identity`; client-supplied copies are always
stripped). The api trusts the forwarded IP only when the HMAC verifies. The browser only
ever sees the web origin for authenticated traffic (sameSite lax cookies). Public
token-authenticated traffic (overlay polling, bot page) goes DIRECT to the api worker via
`publicTrpc` (no cookies) to avoid double-hop request burn on the free tier.

**Per-request factories, no module singletons** (Workers isolate per request):
`createDb()` (packages/db), `createAuth()` (packages/auth), `createContext({ context })`
(packages/api). Never add module-level db/auth/EventEmitter state.

**Real-time = polling.** Overlays poll public tRPC procedures every 3s — POST mutations,
not queries, so the overlay token stays in the request body and out of URLs and logs —
and compute the countdown locally from `targetEndTime`. There is no SSE, no event bus. (The
countdown is local, so the poll only catches state changes; the interval is kept
high to stay within the Cloudflare free-tier request budget.) Every cadence lives in
`apps/web/src/lib/poll-intervals.ts`. Dashboard queries stop when the tab is hidden and
use `dashboardPollInterval`, which slows to 15s after 2 minutes without input — an
authenticated dashboard request is billed twice (web worker → `/rpc` proxy → api
worker), so an untouched dashboard must not out-spend the overlays.

**Twitch bot = browser page.** `/bot/<token>` (token-gated, `instanceConfig.botToken`)
holds the IRC WebSocket (`wss://irc-ws.chat.twitch.tv`) via `apps/web/src/lib/irc-client.ts`,
relays `!`-prefixed chat to `bot.ingest` (stateless, runs command logic against D1), and
sends back the returned replies. Bot lives only while that page is open (OBS browser
source or pinned tab). Chat token comes from `bot.getSession` (server refreshes it; the
refresh token and client secret never reach the browser). Each PRIVMSG's IRC `id` tag is
forwarded as `messageId` and, once it resolves to an enabled Dirework command, claimed in
`processed_chat_message` (pruned after 5 minutes), so a second open bot page is a no-op
and other bots' `!` commands cost no writes. A 60s liveness watchdog sends its own PING
and reconnects if a full tick passes with no inbound line; a `msg_duplicate` NOTICE
re-sends the line once with an invisible suffix, and chat-mode/ban/timeout NOTICE msg-ids
surface as actionable errors. Outbound replies are throttled
by a rolling token bucket (`apps/web/src/lib/rate-limiter.ts`: 20 msgs/30s + ≥1s gap,
bounded queue) — never a fixed spacer. The page revalidates the chat token hourly
(`getSession({ revalidate: true })` → Twitch `/oauth2/validate`) and bounds the
auth-failure recovery loop. Both tRPC clients time-box every request at 30s
(`lib/fetch-timeout.ts`, tRPC's signal combined via `AbortSignal.any` with a fallback),
so a hung `bot.ingest` rejects and the serial ingest queue moves on. The session state machine lives in `apps/web/src/lib/bot-session.ts`
(`createBotSession`, React-free so it is tested with fake timers); errors are classified by
`lib/bot-session-errors.ts`. UNAUTHORIZED = the bot link was reset (`revoked`);
PRECONDITION_FAILED carrying `BOT_REAUTH_REQUIRED_MESSAGE` (shared constant in
`config-shared.ts`, thrown by `twitch-auth.ts`) = the bot's Twitch login can't be refreshed
(`reauth` screen); NOT_FOUND (no bot account or owner) = a `not-configured` phase that polls
every 60s; anything else (incl. SERVICE_UNAVAILABLE from a Twitch 429/5xx) is transient and
backs off exponentially (5s up to 5min, with jitter).

**Command aliases** are stored **canonically without a leading `!`** (`{ t: "task" }`).
`normalizeAliases` / `normalizeAliasToken` + `KNOWN_ALIAS_TARGETS` in
`packages/api/src/config-shared.ts` are the single source shared by the chat resolver
(`resolveAlias`), the `commandAliasesInput` schema, and the dashboard editor — they accept
either form and reject empty, multi-word, built-in-shadowing, duplicate, recursive, and
unknown-target entries (each issue carries its input index so the editor flags the row). (Fixes the old `!!task`
bug where the UI stored `!t → !task` and the resolver re-prefixed `!`.)

**API request logging** uses a structured, redacted middleware
(`apps/server/src/lib/logger.ts`), NOT `hono/logger`: it logs only
`{ id, method, path, status, ms }` with the query string stripped, so OAuth codes/state
and tokens can never reach logs. It stamps an `x-request-id` response header AND puts the
id on the Hono context (`getRequestId(c)`) — downstream middleware needs it before a
response exists, so reading `c.res` there is too late.

**Telemetry** (`apps/server/src/lib/telemetry.ts`) emits one JSON line per event, which is
how Workers observability ingests it. `recordMetric` takes a name from a CLOSED union and
a label matching a safe-token regex; `recordError` logs the error's *name* only — never
its message or stack, because a D1 error echoes SQL (and task text), and a fetch error
echoes the URL (and OAuth codes). Wired at: the rate limiter (429s), the tRPC `onError`
hook (procedure failures — tRPC errors never reach `app.onError`), the bot OAuth
token-exchange and account-upsert paths, and the readiness probe. Bot reconnects happen in
the browser and are deliberately NOT reported back (it would burn free-tier requests).

**`/health` is liveness, `/ready` is readiness.** `/health` has no dependencies, so a D1
outage can't make the worker look dead; `/ready` pings D1 and returns 503 when it can't.

## Monorepo Structure

Turborepo + Bun workspaces (catalog for shared versions). All packages ESM.

```
apps/web           → Next.js 16 on Workers via OpenNext, port 3001 (dev)
apps/server        → Hono API worker, port 3000 (dev)
apps/fumadocs      → Fumadocs documentation site, port 4000 (GitHub Pages)
packages/api       → tRPC routers + services + bot command logic
packages/auth      → Better Auth (Twitch OAuth) — createAuth() factory
packages/db        → Drizzle ORM schema + createDb() (drizzle-orm/d1) + migrations
packages/env       → cloudflare:workers bindings (server), t3-env (web)
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

Browser-bundled web code imports default values from `@dirework/api/config-defaults` and
chat byte helpers from `@dirework/api/chat-text` (both zod- and schema-free, so overlays and
the bot page don't bundle zod); types still come from `config-shared`.

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

**Done-task retention + bounded list reads.** Task polls (overlay every 3s, dashboard)
must never scan the task table — D1's free tier caps rows read at 5M/day.
`listTasks` / `listOverlayTasks` read open tasks plus the newest `DONE_TASK_LIST_LIMIT`
(50) done tasks via `task_status_completed_idx` (status, completed_at), merge them into
list order in JS, and return `{ tasks, counts: { open, done } }` — `counts.done` is an
index COUNT of ALL done rows, so `{done}/{total}` headers must use `counts`, never the
array length. The overlay skips done rows entirely (count only) when `showDone` is off.
`purgeExpiredDoneTasks` (indexed DELETE of done rows with `completed_at` older than
`DONE_TASK_RETENTION_MS` = 24h, best-effort, never throws) runs on writes only:
`createTask`, `markTaskDone`, `replaceActiveTask`, `startTimer`, `resetTimer` — never on a
poll. A test asserts via EXPLAIN QUERY PLAN that none of these queries full-scans.

**Task mutations are atomic.** `activateTask` / `markTaskDone` run their
multi-step work in ONE `db.batch` (atomic on D1), `promoteNextPending` is a
single guarded UPDATE with a subquery, and a **partial unique index**
(`task_one_active_per_author_idx`) makes "≤1 active task per Twitch user" a DB
invariant. `createTask` catches the resulting UNIQUE violation and falls back to
`pending` rather than dropping the chat message. Bot ingest is serialized
client-side (a serial queue in `createBotSession`, `apps/web/src/lib/bot-session.ts`) so chat commands apply in
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
overlay polling) applied in `apps/server/src/lib/rate-limit.ts`. The limiter key
(`clientKey`) is, in order: `session:<sha256>` for a better-auth session cookie whose
HMAC signature verifies offline under `BETTER_AUTH_SECRET` (`lib/session-cookie.ts` —
the limiter runs before better-auth, so an unverified cookie must never mint its own
bucket); `ip:<forwarded>` when the web proxy's `PROXY_SECRET` signature verifies; else
`ip:<CF-Connecting-IP>` (X-Forwarded-For is never trusted). A global
`bodyLimit`; streamed (not buffered) proxy bodies with a 413 pre-check in
`auth-proxy.ts`; and `AbortSignal.timeout` on every outbound Twitch fetch. The
limiter **fails open** if a binding is absent — it's a brake, not a dependency.

Token gates: `verifyOverlayToken` / `verifyBotToken` (constant-time compare, bounded
zod inputs). Never return `accessToken`/`refreshToken` from any procedure (audit H1).

### Database

Schema split: `auth.ts` (Better Auth tables), `app.ts` (instanceConfig, botAccount, task,
timerState, timerConfig, timerStyle, taskStyle, botConfig,
processedChatMessage), `index.ts` (relations).
SQLite idioms: booleans `integer({mode:"boolean"})`, timestamps `integer({mode:"timestamp_ms"})`
with `unixepoch('subsecond')*1000` defaults, JSON columns `text({mode:"json"}).$type<T>()`
(commandAliases, scopes), opacities `real`, cuid2 ids. Config rows are singletons
(`SINGLETON_ID`), lazily provisioned; all columns have defaults. `botAccount` carries a
nullable `refreshLockedUntil` lease that serializes concurrent Twitch OAuth refreshes
(Twitch invalidates the old refresh token on rotation, so the refresh spends the token as
of the lease and persists conditionally on it). Only the holder clears its lease (the
release matches the lease value); a waiter that sees the lease released with tokens
unchanged retries once as holder to surface the real failure; a bot reconnect resets the
lease to null. The API maps flat DB
columns ↔ nested config objects via build/flatten helpers in
`packages/api/src/config-shared.ts`.

Migrations: `bun run db:generate` → SQL in `packages/db/src/migrations` → applied by
Alchemy (dev and deploy). Never edit applied migrations. Migrations are
**expand/contract**: they apply before the new workers go live and the old web worker
keeps serving during the deploy, so a migration only adds (tables, nullable/defaulted
columns, indexes); drop or rename a column one release after no deployed code reads it.

### Authentication

- Better Auth on the api worker; browser reaches it through the web origin proxy.
  `baseURL` = web origin. Cookies sameSite lax/secure/httpOnly. First user to sign in
  claims the instance (`isOwner`); config singletons provisioned on session create.
  A later sign-in by anyone else is refused with the `instance_claimed` error code, which
  better-auth appends to the `errorCallbackURL` (`signInWithTwitch` in
  `lib/auth-client.ts` passes the bare page; `lib/sign-in-errors.ts` maps the code to copy,
  as it does the bot OAuth `/?error=not_authenticated|not_owner` redirects).
  "Claimed" = the `user` table has ANY row (`hasOwner`); there is no in-app ownership
  transfer — recovery from a squatted first deploy is the D1 reset documented in
  deployment.mdx ("Recovering an instance someone else claimed").
- Owner sign-in requests only the `openid` scope; the required email is a
  `<twitch sub>@users.twitch.invalid` placeholder (`twitchPlaceholderEmail`). Account
  linking is disabled (sign-in matches on the Twitch account row). The owner's own
  Twitch OAuth tokens are never stored (account create/update hooks null them) and
  sessions keep no IP or user agent; expired sessions are purged at sign-in. Migration
  `0014_scrub_owner_pii` scrubs rows written by earlier builds. `DISABLED_AUTH_PATHS`
  404s every better-auth route Dirework doesn't use.
- Bot account connection = separate OAuth flow on Hono: `/api/bot/authorize` →
  `/api/bot/callback/twitch` (state cookie, `BOT_SCOPES` = `chat:read chat:edit
  user:read:chat user:write:chat` — the browser bot speaks IRC, which needs the
  `chat:*` pair; the `user:*` Helix pair is unused but kept to avoid a future reconnect;
  error reasons surfaced as `?bot=error&reason=…` toasts — the dashboard maps the code to
  fixed copy via `botOAuthErrorMessage` and never renders the raw query param).
- Server components check sessions via `lib/server-session.ts` (`getServerSession()` —
  forwards cookies to the api worker). Never import `@dirework/auth` or `@dirework/db`
  in apps/web.

### Overlay System

Public routes `/overlay/t/[token]` (timer) and `/overlay/l/[token]` (tasks), transparent
for OBS. Poll `publicTrpc.overlay.getTimerState` / `getTaskList` (POST mutations, token
in the body) every 3s (`refetchIntervalInBackground: true`, `meta: { silent: true }` so a
failed poll never toasts onto the stream); timer display re-renders locally once per
displayed second from `targetEndTime` (a `setTimeout` chain aligned to the countdown's own
second boundary via `msUntilNextSecond`), and the ring uses a matching 1s linear
`stroke-dashoffset` transition. React Query keeps the last payload on failed refetches so
OBS sources don't blank, and the `(overlay)` error boundary renders nothing and re-mounts
after 10s. Two ring shapes: circle + rounded-rect squircle. The timer is drawn at a
fixed pixel size (`config.dimensions`) wrapped in `<AutoScale>` (`components/auto-scale.tsx`),
which uses a ResizeObserver to scale it up/down to fill the OBS browser source while
preserving aspect ratio. While idle the overlay renders a full preview (configured work
length + full ring) instead of blanking, so streamers can position it during setup.
Recommended OBS source sizes (the dashboard's size chips): 300×300 timer, 700×800 tasks.

### Theme Center & Frontend

Design language: **"Focus Console"** — dark-first instrument panel. Montserrat (display,
tabular-nums timer digits), IBM Plex Sans (body), IBM Plex Mono (labels/tokens/status).
Midnight navy base, cerulean accent (`#00ACED`, cornflower secondary) used sparingly
(Twitch purple reserved for the Twitch sign-in/connect buttons), amber = paused, emerald =
live/connected (LED-style chips). All animation respects `prefers-reduced-motion`;
inputs ≥16px on touch (iOS zoom). Destructive actions (token regenerate, disconnect,
clear, stop) always confirm via the AlertDialog primitive. Editors with dirty state use
the unsaved-changes guard hook. 6 theme presets in `lib/theme-presets.ts`.

### Reuse, libraries & UI workflow

DRY is not just the API layer. Before writing a new web component or helper, grep for an
existing home and reuse it:

- **UI primitives** — `apps/web/src/components/ui/` (button, card, alert-dialog, input,
  label, select, tabs, tooltip, switch, slider, dropdown-menu, collapsible, skeleton,
  sonner, callout). Reuse these instead of hand-rolling markup; add a primitive here when a pattern
  repeats (e.g. a destructive callout) rather than copy-pasting it.
- **Shared components** — `confirm-dialog`, `save-bar` (takes `blockedReason` to disable
  Save when the server's input schema would reject the payload), `status-chip`,
  `timer-status-badge`, `unsaved-changes-guard`, `auto-scale`, `loader`, `query-error`
  (failed first load — never render editors over defaults), `secret-url-row`.
- **Error handling** — `lib/trpc-errors.ts` (`describeTrpcError`: transport failures get
  one fixed "can't reach the API" message and a shared toast id), `lib/query-error-toast.ts`
  (the global QueryCache handler; honours `meta.silent`), `lib/validation-errors.ts`
  (`formatMutationError`, `describeIssues`). Each route group has an `error.tsx` boundary.
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

Vitest across `packages/api`, `packages/auth`, `packages/db`, `packages/infra`,
`packages/overlay-kit`, `apps/web`, `apps/server` — run `bun run test`.
Key suites: `packages/api/src/services/__tests__/` (tokens, timer-service, task-service,
twitch-auth), `packages/api/src/routers/__tests__/` (timer-logic, config build/flatten/
round-trip, aliases), `apps/web/src/lib/__tests__/` (timer-utils, task-utils, theme-presets,
config-types, rate-limiter, irc-client, irc-sanitize, server-session, trpc-errors,
api-origin, auth-proxy, bot-session, alias-rows), `apps/server/src/lib/__tests__/` (logger
redaction), `packages/auth/src/__tests__/has-owner.test.ts`,
`packages/auth/src/__tests__/create-auth.test.ts` (drives the REAL `createAuth()`: owner
claim, linking refused, owner tokens dropped, openid-only scope, disabled paths,
`DEV_LOGIN` gate, session IP/UA and expired-session purge),
`packages/db/src/migrations/__tests__/` (data migrations run in sql.js).
`packages/auth/vitest.config.ts` aliases `cloudflare:workers` to a stub, and
`packages/auth/src/__tests__/stubs/test-db.ts` gives real drizzle over sql.js with every
migration applied (only `createDb` is mocked).
`packages/api/src/__tests__/app-router.test.ts` drives the REAL `appRouter` via
`createCaller` (auth, owner authorization, validation, DB effects, error
mapping). This works because `packages/api/vitest.config.ts` aliases
`cloudflare:workers` to a stub — without it, any chain touching
`@dirework/env/server` can't load under Node and router tests degrade into
schema-only checks.
Anything whose correctness depends on SQL predicates or indexes (guarded UPDATEs,
`NOT EXISTS`, unique/expression indexes) runs against real SQLite via `createSqliteDb` in
`packages/api/src/__tests__/helpers/sqlite-db.ts` (drizzle-orm/sql-js with every migration
applied; it emulates `db.batch` as a transaction and patches drizzle 0.45's sql-js
relational mapper) — see `packages/api/src/__tests__/bot-ingest.test.ts` and
`packages/api/src/services/__tests__/task-service.sqlite.test.ts`. Mocks ignore predicates.
New pure functions → extract to testable modules + add tests. **Never assert on
an object literal the test itself constructed** — that passes with the
implementation deleted; drive the real function instead.

## CI/CD

**All actions are SHA-pinned** (with a trailing `# vN` comment); Dependabot moves the
pins (codeql-action init/analyze are grouped so they share one SHA). Every workflow
declares minimal `permissions`. Dependabot's `bun` ecosystem skips `catalog:` entries,
so catalog pins are bumped by hand.

- `.github/workflows/verify.yml` — **the single verification pipeline**
  (install → dependency audit → design-token drift check → lint → check-types →
  test:coverage → build), called via `workflow_call`. CI and deploy both use it, so the
  deploy gate cannot drift from the PR gate. `build` is skippable via the `run-build`
  input; `upload-docs` also builds and uploads the verified docs static export for Pages.
  `audit-blocking` (default `true`): ci.yml keeps the default, so PRs/pushes FAIL on
  high advisories; deploy.yml and deploy-docs-to-pages.yml pass `false`, so the audit
  still runs but only emits a `::warning::` annotation (`continue-on-error`) — an
  advisory published today must never block a revert or hotfix. A test in
  `packages/infra/__tests__/workflow-security.test.ts` pins this split.
  The web app is built with `build:worker` (OpenNext build + wasm fix + static-assets cache
  population) — the exact script Alchemy runs at deploy — so that pipeline fails here,
  not after migrations are applied. Coverage measures every `src/` file
  (`coverage.include`), not just imported ones.
- `.github/workflows/codeql.yml` — CodeQL JavaScript/TypeScript analysis plus a separate
  GitHub Actions (workflow) analysis job, both with the `security-extended` query suite on
  pushes, PRs, and a weekly schedule.
- `.github/workflows/audit.yml` — daily + manual: `bun run audit:dependencies` against
  the lockfile, so an advisory published between pushes fails a run and notifies the
  owner.
- `.github/workflows/ci.yml` — push (dev/main) + PRs: calls `verify.yml`, plus a
  `dependency-review` job on PRs (fails on high-severity advisories). GitHub's
  dependency graph reads only literal `package.json` ranges — not `bun.lock` or
  `catalog:` versions — so `bun audit` (in `verify.yml`) is the real lockfile gate.
- `.github/workflows/deploy.yml` — push to main (or manual): `verify.yml` **including the
  build**, then validates required secrets/vars, then Alchemy deploy.
  **Deploy runs under Node via the lockfile-pinned local `tsx`
  (`node ./node_modules/.bin/tsx`) — Bun segfaults on the Alchemy program** (same lesson
  as Wolfathon), and `npx -y` would fetch an unpinned tsx at deploy time.
  Secrets: `CLOUDFLARE_API_TOKEN`, `ALCHEMY_PASSWORD`, `ALCHEMY_STATE_TOKEN` (**shared
  fleet token** — auths the shared account-wide `alchemy-state` store worker; the shared
  token is what makes sharing safe, a per-app token against it is the "token is invalid"
  clash), `BETTER_AUTH_SECRET`, `PROXY_SECRET` (min 32 chars; signs the forwarded client
  IP — `resolveProxySecret` refuses to invent one outside `--dev`, where it is generated
  per run), `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`. Repository
  **variables**: `BETTER_AUTH_URL`, `CORS_ORIGIN` (required); `DOCS_URL`,
  `PRIVACY_POLICY_URL`, `TERMS_OF_SERVICE_URL` (optional).
  A manual dispatch takes a `force_state_token` input (→ `ALCHEMY_STATE_FORCE_UPDATE`)
  for one-time state-token recovery; normal push deploys leave it false.
  **`NEXT_PUBLIC_SERVER_URL` is deliberately NOT a deploy variable** — Alchemy injects the
  api worker's resolved URL at build and runtime, so setting it would be dead config.
  The last step is a smoke check (`packages/infra/smoke-check.ts`): api `/ready` must pass
  and web `/api/version` must report the deployed commit.
- `.github/workflows/deploy-docs-to-pages.yml` — `verify.yml` with `upload-docs` →
  fumadocs static export → GitHub Pages. Runs only on the upstream repo, so forks
  don't fail on a Pages site they never enabled.
- `.github/workflows/update-license-year.yml` — Jan 1: opens a PR bumping the LICENSE
  year (main is PR-only, so it never pushes to main).

## Deployment

Production: `dirework.mrdemonwolf.workers.dev` (web) + `dirework-api.mrdemonwolf.workers.dev`
(api) + `dirework-db` (D1). Twitch app redirect URLs point at the WEB origin:
`/api/auth/callback/twitch` and `/api/bot/callback/twitch`. Docs:
`apps/fumadocs/content/docs/deployment.mdx`.

Pinned in `packages/infra` (change deliberately, never via a dependency bump):
- **Compatibility date** — `COMPATIBILITY_DATE` in `deploy-config.ts`, used by both
  workers and by apps/server's dry-run bundle check (a test asserts they match).
  `apps/web/wrangler.jsonc` is generated by Alchemy and gitignored.
- **Alchemy stage** — deploy/destroy use `resolveDeployStage` (`runner` unless
  `ALCHEMY_STAGE` is set), so a local destroy with `CI=true` + `ALCHEMY_STATE_TOKEN`
  finds the CI deploy's state. Local dev keeps Alchemy's per-user stage.
- **Rate-limit namespace ids** are account-wide. Fleet allocation on the shared account:
  linkden production 1000s, linkden non-prod 2000s, **dirework 3001–3004**.
- **Observability** — logs plus Workers Traces at 5% head sampling on both workers.
- **Caching** — OpenNext uses the read-only static-assets incremental cache (prerendered
  routes such as `/opengraph-image` render once at build); `apps/web/public/_headers`
  marks hashed `/_next/static/*` immutable.

## Git Workflow

- `main` — production (deploys on push)
- `dev` — development branch; PR to `main` for releases

## Environment Variables

Server worker bindings (typed via `packages/env/env.d.ts` from `alchemy.run.ts`):
`DB` (D1), the four rate-limit bindings (`RL_AUTH`, `RL_BOT`, `RL_TOKEN`, `RL_OVERLAY`),
`CORS_ORIGIN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PROXY_SECRET`, `TWITCH_CLIENT_ID`,
`TWITCH_CLIENT_SECRET`, `DOCS_URL`, plus dev-only `DEV_LOGIN` (gates the Twitch-less
`POST /api/auth/dev-login` owner-session bypass — never set in production) and
`DEV_LOGIN_SECRET` (the per-run `x-dev-login-secret` that endpoint requires, generated and
printed by `alchemy.run.ts` in dev, "" otherwise — the dev servers listen on every interface). Web worker:
`NEXT_PUBLIC_SERVER_URL`, `BETTER_AUTH_URL`, `PROXY_SECRET` (runtime binding read via
`process.env`, never `NEXT_PUBLIC_`), optional `PRIVACY_POLICY_URL` /
`TERMS_OF_SERVICE_URL`, and build-time `NEXT_PUBLIC_DEV_LOGIN` (shows the dev-bypass button).
Deploy also needs the GitHub secrets `ALCHEMY_STATE_TOKEN` and `PROXY_SECRET` (see CI/CD).
`NEXT_PUBLIC_SERVER_URL` is **local-only** — Alchemy injects it in production; never set
it as a GitHub variable. `SKIP_ENV_VALIDATION=true` bypasses t3-env during CI/build and
is baked into the `check-types` scripts so a fresh clone can type-check.

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
