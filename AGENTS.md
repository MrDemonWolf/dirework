# AGENTS.md

This file provides guidance for coding agents working on the Dirework codebase.

## Critical Documentation Reference

**ALWAYS update this section** when creating or discovering important docs to prevent context loss.

- Historical records (completed plans and reviews) live in `docs/history/`:
  - Node/Postgres → Cloudflare migration (completed) → `docs/history/MIGRATION.md`
  - Pre-migration audit (29 findings, all addressed in the port) → `docs/history/AUDIT-cloudflare-migration.md`
  - Marketing website research and UI/UX review → `docs/history/MARKETING-REVIEW.md`
  - Logo generation prompt → `docs/history/logo.md`
- Security policy and production operator checklist → `SECURITY.md`
- Database schemas → `packages/db/src/schema/` (index.ts, auth.ts, app.ts)
- Setup guides → `.env.example`, docs `apps/fumadocs/content/docs/deployment.mdx`
- Contributor setup + branch/PR workflow → `CONTRIBUTING.md`
- Design system (tokens → generated CSS for app + docs, component specs) → `design-system/` (README), docs `apps/fumadocs/content/docs/design-system.mdx`; drift check `bun run tokens && git diff --exit-code`
- Which Cloudflare services to use beyond Workers + D1 (KV, Durable Objects, Queues, Cron, …) → `docs/decisions/0001-cloudflare-services.md`
- PR review checklist (Codex + humans; free-tier cost rules) → `## Code Review Rules` below
- Owner to-dos (secrets move, Codex auto-review) + product backlog → `TODO.md`

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

**SSR prefetch + hydration.** `/dashboard`, `/dashboard/styles` and `/dashboard/bot` render
with their data: each page runs `requireSession()` first (a signed-out visitor never spends a
batch), then `prefetchDashboard` / `prefetchStyles` / `prefetchBot` (`lib/server-query.ts`),
which use a per-call `createServerTrpc(queryClient)` (`lib/server-trpc.ts`, no module state)
to issue every query in one tick — `httpBatchLink` folds them into ONE GET straight to the
api worker's `/trpc` (cookie + signed client IP, 5s `INTERNAL_FETCH_TIMEOUT_MS`; never via
`/rpc`). The dehydrated cache goes into a `<HydrationBoundary>`; query keys are path + input
only, so they match the browser `trpc` proxy's. `prefetchQuery` never throws and `dehydrate`
keeps only successes, so a failed prefetch falls back to the client fetch (and its skeleton).
The client `QueryClient` defaults `staleTime` to `QUERY_FRESH_MS` (30s, `poll-intervals.ts`)
so hydrated data isn't refetched on mount; polls and invalidations ignore staleness, so no
cadence changes. `getServerSession` is wrapped in React `cache()`, so the `(app)` layout
(which passes the session to `Header`/`UserMenu` as a prop — no client `useSession`) and the
page share one get-session fetch. A dashboard hard load costs 2 api requests (get-session +
the batch) and no web-worker `/rpc` hops before the first poll.

**Per-request factories, no module singletons** (Workers isolate per request):
`createDb()` (packages/db), `createAuth()` (packages/auth), `createContext({ context })`
(packages/api). Never add module-level db/auth/EventEmitter state.

**Real-time = polling.** Overlays poll public tRPC procedures every 5s — POST mutations,
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
relays chat to `bot.ingest` (stateless, runs command logic against D1), and
sends back the returned replies. Only lines whose first word is a Dirework command or an
alias are relayed (`isDireworkCommandLine` in the zod-free `@dirework/api/chat-commands`,
which also owns `KNOWN_ALIAS_TARGETS` / `META_COMMANDS` / `normalizeAliasToken` and is
the parser `handleMessage` uses); `bot.getSession` returns the alias keys, so new aliases
reach an open page at the hourly revalidation or on reload. Disabled commands are still
relayed (the server drops them), so an enable toggle applies instantly. `MODERATION_COMMANDS`
(`mute`/`unmute`/`block`/`unblock`, also in `chat-commands`) are built-in names (relayed, never
aliasable) but NOT alias targets; they are mod-only. `handleMessage` gates every line on the
`bot_config` row ingest already loads, BEFORE any claim: a blocked login (unless broadcaster)
and anything but a mod's `!unmute` while muted return silently, so they cost no write.
`bot.ingest` returns `{ replies, muted }` (the post-command mute state, so the page's "Muted"
status follows `!mute` without a request) and `bot.getSession` carries `muted` from its single
bot_config read. Bot lives only while that page is open (OBS browser
source or pinned tab). Chat token comes from `bot.getSession` (server refreshes it; the
refresh token and client secret never reach the browser). Each PRIVMSG's IRC `id` tag is
forwarded as `messageId` and, once it resolves to an enabled Dirework command, claimed in
`processed_chat_message` (pruned after 5 minutes via the `processed_at` index), so a second open bot page is a no-op
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
`normalizeAliases` (`config-shared.ts`) / `normalizeAliasToken` + `KNOWN_ALIAS_TARGETS`
(`packages/api/src/chat-commands.ts`, re-exported by `config-shared`) are the single source shared by the chat resolver
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
`/ready` also reports `limits`: `ok`, or `missing:RL_AUTH,…` naming the rate-limit bindings
that did not attach (`missingRateLimitBindings` in `apps/server/src/lib/rate-limit.ts` — a
property check on the env, never a `limit()` call). The status stays 200 either way: the
limiter fails open by design and readiness must not flap, so the post-deploy smoke check is
what requires `ok`.

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
packages/fonts     → self-hosted UI woff2 files (Montserrat, IBM Plex Sans/Mono) both apps load via next/font/local; no code
packages/overlay-kit → pure overlay geometry (squircle path) + clock formatting + `BRAND` copy + `DEMO_SESSION` demo data, shared by web overlays, docs mocks and both OG cards; zero runtime deps
packages/e2e       → Playwright browser tests: both workers in local workerd over a fresh local D1 (CI gate)
packages/config    → Shared TypeScript configuration
```

## Commands

```bash
bun run dev           # Alchemy dev: api worker :3000 + web :3001 + local D1 (migrations applied) + docs :4000
bun run dev:web       # Web app only (standalone Next dev :3001; API comes from `bun run dev` or a deployed origin)
bun run build         # Build all apps
bun run check-types   # TypeScript type checking across all packages
bun run test          # Vitest unit tests across all packages
bun run e2e           # Playwright browser tests (build the web worker first; see Testing)
bun run db:generate   # Generate a Drizzle migration from schema changes
bun run deploy        # Alchemy deploy (both workers + D1) — CI does this on main
bun run destroy       # Tear down the Cloudflare deployment
```

Local env lives in `packages/infra/.env` (+ mirrored `apps/server/.env`,
`apps/web/.env`); see `.env.example`.

Browser-bundled web code imports default values from `@dirework/api/config-defaults`,
chat byte helpers from `@dirework/api/chat-text`, and command names from
`@dirework/api/chat-commands` (all zod- and schema-free, so overlays and the bot page don't
bundle zod); types still come from `config-shared`.

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
- **TypeScript 7** (native `tsc`) strict everywhere; **Vitest** for tests

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

**Setup checklist flags ride on `user.me`:** `me` selects the three `setup*Confirmed`
columns from the `instance_config` row it already reads and returns
`setup: { botSource, timerOverlay, tasksOverlay }` (no extra statement).
`user.confirmSetupStep` (`ownerProcedure`; `confirmSetupStepInput` = `step` enum +
`confirmed`, strict) is one `updateSingleton` UPDATE of exactly that column per click and
returns the fresh `setup`, so the dashboard can patch `me` in place instead of refetching.
Detection is explicit owner confirmation: a flag must never be set from an overlay poll
or `bot.ingest`, which would be a write on a poll path.
Owner actions that kill a confirmed URL clear its flag in the write they already do:
`rotateInstanceToken` (overlay or bot URL reset) un-confirms that step in the same UPDATE,
and `disconnectBotAccount` resets `setupBotSourceConfirmed` in the batch that deletes the
account (`user.disconnectBot` returns the fresh `setup`).
The dashboard renders it as the **"Set up streaming" checklist**
(`components/setup-checklist.tsx`; steps, copy and progress math in the pure
`lib/setup-steps.ts`): step 1 (bot account) is the only *detected* step (`me.botAccount`);
steps 2–4 are the owner's "I added it to OBS" / "Mark as not added" clicks — explicit
confirmation, never detection. A click patches only `setup` on the current `user.me`
entry with a functional `setQueryData` (optimistic; rollback restores just that flag, never a
snapshot), never cancels an in-flight `user.me` fetch (an overlay reset's refetch carries
the rotated token), and refetches once only if such a fetch overlapped or the write failed
(`shouldRefreshMeAfterConfirm`); the checklist never polls, and the bot page URL
(`bot.getIngestInfo`) loads only while step 2 is open. Step handoffs reuse `SecretUrlRow`
without its Reset action (omit `onRegenerate`). "Finish later" is per-browser localStorage
(`dirework.setup-collapsed`); the header band's Setup button reopens the card.

**Done-task retention + bounded list reads.** Task polls (overlay every 5s, dashboard)
must never scan the task table — D1's free tier caps rows read at 5M/day.
`listTasks` / `listOverlayTasks` read open tasks plus the newest `DONE_TASK_LIST_LIMIT`
(50) done tasks via `task_status_completed_idx` (status, completed_at), merge them into
list order in JS, and return `{ tasks, counts: { open, done, doneByAuthor } }` — `counts.done` /
`counts.doneByAuthor` are index COUNTs of ALL done rows (overall and per author), so
`{done}/{total}` headers, including each author group's, must use `counts`, never the
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
Dashboard removal is one click with an Undo toast: `task.restore` → `restoreTask`
re-inserts the removed row (same id, author, placement, timestamps) in ONE INSERT … SELECT;
a removed `active` task comes back `pending` if removal promoted another, so the
single-active index holds. Owner action, so no viewer caps apply.

**Services own mutations** (`packages/api/src/services/`): `task-service`, `timer-service`,
`overlay-service`, `bot-moderation`, `twitch-auth`, `tokens`, `singleton`, `provision`. Both tRPC routers and
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
zod inputs). Resetting the bot URL (`bot.regenerateBotToken`) also kills the chat token the
old page was handed: `revokePreviousChatToken` refreshes through the lease, then revokes the
previous access token at Twitch (revoking an access token does not kill the refresh token),
best-effort inside `REVOKE_BUDGET_MS` (shared with `disconnectBotAccount`, under the
`/rpc` proxy's 15s); the URL always rotates first, and `chatToken`
(`revoked`/`unconfirmed`/`no-account`) drives fixed dashboard copy. Never return `accessToken`/`refreshToken` from any procedure (audit H1).

### Database

Schema split: `auth.ts` (Better Auth tables), `app.ts` (instanceConfig, botAccount, task,
timerState, timerConfig, timerStyle, taskStyle, botConfig,
processedChatMessage), `index.ts` (relations). `instanceConfig` holds the three tokens,
the cached `channelLogin`, and the dashboard setup checklist flags
`setupBotSourceConfirmed` / `setupTimerOverlayConfirmed` / `setupTasksOverlayConfirmed`
(`integer({mode:"boolean"})`, NOT NULL default false; added expand-only by
`0018_setup_confirmations`), which only `user.confirmSetupStep` writes. `botConfig.muted`
(boolean) and `botConfig.blockedViewers` (JSON array of lowercase logins, ≤
`MAX_BLOCKED_VIEWERS` = 200; added expand-only by `0019_bot_mute_blocklist`) are written only
by `services/bot-moderation.ts` (shared by the chat commands and `config.setBotMuted` /
`blockViewer` / `unblockViewer`) as guarded JSON1 UPDATEs — `json_insert` under `NOT EXISTS
(… json_each …)` plus the cap, `json_group_array` filter under `EXISTS` — never a
read-modify-write; blocking deletes the viewer's tasks in the same `db.batch`.
SQLite idioms: booleans `integer({mode:"boolean"})`, timestamps `integer({mode:"timestamp_ms"})`
with `unixepoch('subsecond')*1000` defaults, JSON columns `text({mode:"json"}).$type<T>()`
(commandAliases, scopes), opacities `real`, cuid2 ids. Config rows are singletons
(`SINGLETON_ID`), lazily provisioned; all columns have defaults. The bot_config `msg_*`
column defaults are **frozen** (`*_MESSAGE_COLUMN_DEFAULTS` in `packages/db/src/defaults.ts`):
the wording the app uses is `DEFAULT_*_MESSAGES`, and `buildBotConfig` reads any stored value
that equals a frozen or legacy default (`LEGACY_*_MESSAGES`) back as the current default, so
rewording a reply needs no migration — append the old wording to the legacy list instead. `botAccount` carries a
nullable `refreshLockedUntil` lease that serializes concurrent Twitch OAuth refreshes
(Twitch invalidates the old refresh token on rotation, so the refresh spends the token as
of the lease and persists conditionally on it). Only the holder clears its lease (every
release, including the successful token write, matches the lease value — a holder whose
lease expired still saves the tokens Twitch rotated but leaves the newer lease alone, and
a caller whose spent token Twitch rejects returns tokens another caller published instead
of surfacing reauth); a waiter that sees the lease released with tokens
unchanged retries once as holder to surface the real failure; a bot reconnect resets the
lease to null. The API maps flat DB
columns ↔ nested config objects via build/flatten helpers in
`packages/api/src/config-shared.ts`.

Migrations: `bun run db:generate` → SQL in `packages/db/src/migrations` → applied by
Alchemy (dev and deploy). Never edit applied migrations. Migrations are
**expand/contract**: they apply before the new workers go live and the old web worker
keeps serving during the deploy, so a migration only adds (tables, nullable/defaulted
columns, indexes); drop or rename a column — or drop an index — one release after no deployed code reads
it (e.g. `0017_drop_task_status_idx` contracted 0015's superseded `task_status_idx`).

### Authentication

- Better Auth on the api worker; browser reaches it through the web origin proxy.
  `baseURL` = web origin. Cookies sameSite lax/secure/httpOnly. First user to sign in
  claims the instance (`isOwner`); config singletons provisioned on session create.
  A later sign-in by anyone else is refused with the `instance_claimed` error code, which
  better-auth appends to the `errorCallbackURL` (`signInWithTwitch` in
  `lib/auth-client.ts` passes the bare page; `lib/sign-in-errors.ts` maps the code to copy,
  as it does the bot OAuth `/?error=not_authenticated|not_owner` redirects;
  `instance_claimed` also carries a `cta` linking to the deploy guide).
  `/` (`app/(app)/page.tsx`) sends the owner to `/dashboard` and an unclaimed instance to
  `/setup`, so only non-owners ever see it: it renders `viewer-landing.tsx`, a static
  server component (no queries, no polling; `viewer-landing.test.ts` pins it and the e2e
  spec `15-landing` asserts zero `/rpc` requests) built from `BRAND`, `DEMO_SESSION`
  (`components/stream-scene.tsx`) and the shared command rows (`lib/command-rows.ts`, also
  the Bot settings reference). The page reads `?error=` from `searchParams` and passes the
  resolved copy to the `sign-in-notice.tsx` island, which only strips the query via
  `history.replaceState`; `owner-sign-in.tsx` holds the one "Sign in with Twitch" button
  (the header's signed-out button hides on `/` and `/setup`). Docs links come from the web
  worker's `DOCS_URL` binding (`lib/landing-links.ts`). `/setup` (unclaimed only) is built
  the same way: a static server component (`setup/setup-content.tsx`, pinned by
  `setup-page.test.ts`) with the `claim-button.tsx` island ("Claim with Twitch", error
  callback `/setup`), the same `?error=` notice, and `<StreamScene compact>` (overlays, no
  chat). Its headings are single text nodes because `00-first-run` greps the raw HTML.
  "Claimed" = the `user` table has ANY row (`hasOwner`); there is no in-app ownership
  transfer — recovery from a squatted first deploy is the D1 reset documented in
  deployment.mdx ("Recovering an instance someone else claimed").
- Owner sign-in requests only the `openid` scope; the required email is a
  `<twitch sub>@users.twitch.invalid` placeholder (`twitchPlaceholderEmail`). Account
  linking is disabled (sign-in matches on the Twitch account row). The owner's own
  Twitch OAuth tokens are never stored (account create/update hooks null them) and
  sessions keep no IP or user agent; expired sessions are purged at sign-in. Migration
  `0014_scrub_owner_pii` scrubs rows written by earlier builds, but migrations apply before cutover, so a sign-in served
  by the old worker could write tokens back. The token scrub is therefore re-run after
  cutover on every deploy (`packages/infra/post-deploy.ts`, called from `alchemy.run.ts`)
  and at every sign-in (`scrubOwnerTokens`). `DISABLED_AUTH_PATHS`
  404s every better-auth route Dirework doesn't use; it only matches exact paths, so
  parameterized ones (`/reset-password/:token`) go in `DISABLED_AUTH_PATH_PREFIXES`,
  404ed by a small `onRequest` plugin. From better-auth 1.7.11 the Twitch id_token is
  signature-verified against Twitch's JWKS (`https://id.twitch.tv/oauth2/keys`, one
  extra fetch per sign-in); `create-auth.test.ts` signs test tokens RS256 and stubs it.
- Bot account connection = separate OAuth flow on Hono: `/api/bot/authorize` →
  `/api/bot/callback/twitch` (state cookie, `BOT_SCOPES` = `chat:read chat:edit
  user:read:chat user:write:chat` — the browser bot speaks IRC, which needs the
  `chat:*` pair; the `user:*` Helix pair is unused but kept to avoid a future reconnect;
  only Twitch's `access_denied` is a cancel — any other Twitch `error` is
  `authorization_failed`; error reasons surfaced as `?bot=error&reason=…` toasts — the dashboard maps the code to
  fixed copy via `botOAuthErrorMessage` and never renders the raw query param).
- Server components check sessions via `lib/server-session.ts` (`getServerSession()` —
  forwards cookies to the api worker). Never import `@dirework/auth` or `@dirework/db`
  in apps/web.

### Overlay System

Public routes `/overlay/t/[token]` (timer) and `/overlay/l/[token]` (tasks), transparent
for OBS. Poll `publicTrpc.overlay.getTimerState` / `getTaskList` (POST mutations, token
in the body) every 5s (`refetchIntervalInBackground: true`, `meta: { silent: true }` so a
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
Before the first payload lands, and whenever the server answers null (invalid or reset
token), both overlays render nothing (`lib/overlay-view.ts`), so a stale OBS URL goes
blank instead of showing a fake 00:00 timer or empty list.
Recommended OBS source sizes (the dashboard's size chips): 300×300 timer, 700×800 tasks.

**Style defaults upgrade on read** (same idea as the bot replies): the timer_style/task_style
column defaults are frozen (`TIMER_STYLE_COLUMN_DEFAULTS` / `TASK_STYLE_COLUMN_DEFAULTS` in
`packages/db/src/defaults.ts`); the look a fresh instance gets is `DEFAULT_TIMER_STYLES` /
`DEFAULT_TASK_STYLES` (same file, re-exported by `@dirework/api/config-defaults`; the
"Default" preset IS these objects). `buildTimerStylesConfig` / `buildTaskStylesConfig` run
`upgradeLegacyStyleRow` first: per style group (`ring`, `fontSizes`, `header`, `task`…), when
EVERY column still holds the frozen default or a `LEGACY_*_STYLE_VALUES` entry, the group
reads back as the current default. Group-level, not per column, so a saved preset that
repeats one old default (Minimal Light's 1px borders) reads back exactly as saved — a test
round-trips every preset. Trade-off: a whole group hand-set to exactly the old defaults reads
as "never customized". To change a default, edit `DEFAULT_*_STYLES` and append the replaced
value to `LEGACY_*_STYLE_VALUES`; no migration. The active task row is a static username-color
tint plus an "Active" label (no glow); renderer constants (`TIMER_CYCLE_OPACITY`,
`ACTIVE_ROW_TINT_PERCENT`, `MORE_FOOTER_OPACITY`, `TASK_ROW_GAP_PX`) live in
`lib/overlay-view.ts` and are contrast-tested per preset.
Overlay font faces are self-hosted (`public/fonts/fonts.css`, generated by
`scripts/fetch-fonts.ts`) and loaded only by the `(overlay)` layout and the Theme Center page;
the dashboard's own faces come from `lib/fonts.ts` (body/mono, on `<body>`, not preloaded) and
`lib/heading-font.ts` (Montserrat, preloaded, published on `<body>` by the `(app)` layout only,
via `headingFontBodyCss` — on body, not a wrapper, so portaled dialogs and menus inherit it; the
root, `(bot)` and `(overlay)` layouts never import it, so an overlay or bot console never fetches
it). `font-scope.test.ts` pins all of it. Those UI faces (and the docs site's, in
`apps/fumadocs/src/app/layout.tsx`) are `next/font/local` over the self-hosted woff2 files in
`packages/fonts/files` (Montserrat 400–800 variable, Plex Sans 400–700 variable, Plex Mono
400/500/600), so builds make NO network calls — `next/font/google` downloads at build time and
failed CI whenever the runner couldn't reach Google (`Can't resolve
'@vercel/turbopack-next/internal/font/google/font'`). `scripts/fetch-fonts.ts` (`UI_FACES`) is
the only thing that talks to Google Fonts, run by hand; `packages/fonts`' test forbids
`next/font/google` in either app and checks every `src` path resolves to a committed file.

### Theme Center & Frontend

Design language: **"Focus Console"** — dark-first instrument panel. Montserrat (display,
tabular-nums timer digits), IBM Plex Sans (body), IBM Plex Mono (labels/tokens/status).
Midnight navy base, cerulean accent (`#00ACED`, cornflower secondary) used sparingly
(Twitch purple reserved for the Twitch sign-in/connect buttons), amber = paused, emerald =
live/connected (LED-style chips). All animation respects `prefers-reduced-motion`;
inputs ≥16px on touch (iOS zoom). Destructive actions (token regenerate, disconnect,
clear, stop) always confirm via the AlertDialog primitive. Editors with dirty state use
the unsaved-changes guard hook. 6 theme presets in `lib/theme-presets.ts`.
**Theme Center** (`/dashboard/styles`, `styles-page.tsx`): editor column (`lg:flex-1`) beside
a sticky `lg:w-96` preview (`theme-center/style-preview-panel.tsx`), which renders the REAL
`TimerDisplay` / `TaskListDisplay` client-side (no polling) over `lib/preview-session.ts` —
`DEMO_SESSION`'s tasks and countdown, so the preview, landing and docs agree. One overlay at
a time (`aria-pressed` "Preview timer" / "Preview tasks"), both scaled with `AutoScale` (tasks
drawn at the 700×800 source). Backdrops dark / light / bright / checker are CSS classes in
`index.css` (`preview-scene-*`, `bg-checker`), deliberately outside the palette. The preview's
header chip is the page's dirty indicator ("Previewing unsaved changes" / "Matches the saved
theme"); `SaveBar` takes `label` and `saveHint` (Theme Center: "Unsaved — not on stream yet",
"Saving updates both OBS overlays", the Save button's description).
Editor layout: `ThemeBrowser` is a `grid-cols-2 md:grid-cols-3 xl:grid-cols-6` radiogroup
("Theme presets") with roving tabindex driven by `lib/grid-navigation.ts` (`nextGridIndex`;
columns read from the live grid). Tabs "Timer style" / "Task style" / "Phase labels";
`TabsTrigger` takes `dirty` (amber dot + sr-only "(unsaved changes)"). The two style editors
are thin wrappers over `theme-center/style-sections-editor.tsx`, which renders
`TIMER_STYLE_FIELDS` / `TASK_STYLE_FIELDS` from `lib/style-sections.ts`: every style leaf
path has exactly one field and one section (Colors · Typography · Layout · Opacity; Colors
opens first) plus a `group` (fieldset legend). `style-sections.test.ts` holds both lists to
`leafPaths(DEFAULT_*_STYLES)`, so a new style key must get a field. `SectionGroup` takes a
`menu` (rendered beside, not inside, the toggle button); each section's menu "Reset section"
→ `resetSection` (to the Default preset's values), and the page's "Theme options" menu →
"Reset theme to Default"; both confirm and only change the draft.

**Design tokens are generated.** `design-system/tokens.json` → `design-system/scripts/render.ts`
(pure) + `generate.ts` (I/O) → `apps/web/src/tokens.generated.css` (imported by `index.css`)
and `apps/fumadocs/src/app/tokens.generated.css` (imported by `global.css`, which maps it onto
the `--color-fd-*` / `--bg-*` / `--txt-*` names). Edit `tokens.json` and run `bun run tokens`;
never edit a generated file (`design-tokens.test.ts` and the CI drift step fail). The docs twin
has no radius scale (fumadocs-ui compiles its own `rounded-*` against it); fonts stay
hand-written in both stylesheets (they wrap next/font variables). Palette AA is asserted by
`tokens-contrast.test.ts`.
**Installable app + touch.** `app/manifest.ts` serves `/manifest.webmanifest` (standalone,
`start_url` `/dashboard`, `DARK_BACKGROUND_HEX`/`LIGHT_BACKGROUND_HEX` = the two
`--background` tokens as hex) with PNG icons in `public/icons/` (192, 512, maskable 512 —
logo inside the inner 80% on the dark background) plus `app/apple-icon.png` (180×180,
opaque); `icon.svg` stays the favicon. Only the `(app)` layout links the manifest and the
`appleWebApp` tags, so overlay and bot loads never fetch it. The root `viewport` export sets
`viewportFit: "cover"`, `colorScheme`, and per-scheme `themeColor` (the SSR fallback;
`components/theme-color-sync.tsx`, mounted by `(app)`, rewrites the tags from next-themes'
`resolvedTheme` via `lib/theme-color.ts`); the header, main, footer, save bar, and toasts
pad with `env(safe-area-inset-*)` on the bottom and both sides. **No service worker**: install
doesn't need one and an offline live dashboard would only show stale state. Touch
conventions: hide hover-revealed controls with `can-hover:opacity-0` (custom variant on
`@media (hover: hover)` in `index.css`), never a width breakpoint — `lg:opacity-0` hid them
on touch tablets; size touch targets with the built-in `pointer-coarse:` variant
(`ui/button.tsx`, `ui/input.tsx`). `touch-targets.test.ts` and `manifest.test.ts` pin it.

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
  overlay geometry/formatting (`formatClock`, `cycleLabel`) in `@dirework/overlay-kit`, which
  also holds `BRAND` (the one tagline/description for metadata, docs hero, share cards) and
  `DEMO_SESSION` (the example session every mock and card renders; its bot replies are held
  to the real defaults by `apps/web/src/lib/__tests__/demo-session.test.ts`).
- **Constants** — timer/config defaults come from `@dirework/db/defaults` (re-exported via
  `@dirework/api/config-shared`); never re-type `25*60*1000` etc. The M1/M3/M4 "don't
  duplicate" rules apply to the web component layer too, not only services/config.
- **Design tokens** — never use arbitrary values for type/tracking/z/widths (or raw
  `zinc-*`/`slate-*`/`gray-*` classes): use the tokens (`text-2xs`, `tracking-label`,
  `z-(--z-header)`, `max-w-content`, `w-editor`, `h-header`, `bg-console-base` …) or
  `apps/web/src/lib/__tests__/token-bypass.test.ts` fails. Its allow-list only shrinks.

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
The theme is applied before first paint by a static inline script in the root layout's
`<head>` (`lib/theme-init.ts`, kept in sync with the next-themes props in
`providers.tsx`), and `html` carries the theme background and `color-scheme`, so a
streamed dark page never paints white first. Pre-mount theme placeholders (the header
`ModeToggle`) style themselves with `dark:` classes off that class rather than guessing.
`TimerProvider` seeds its editable minutes lazily (`useState(() => …)`) from the hydrated
`config.get`, so server and first client render agree on the configured durations (no
"25:00" → configured-minutes flash); its seeding effect remains only for the
failed-prefetch fallback.
**No context update may reach a streamed page before it hydrates.** React batches streamed
Suspense reveals (up to ~300ms after first paint); an update that reaches a boundary still
waiting for its reveal makes React discard the server HTML and client-render it — silently in
production, with both copies in the DOM until the reveal runs. next-themes' context value
flips right after hydration whenever the OS scheme differs from the app theme, so its
provider wraps only a bridge (`components/theme-provider.tsx`) that copies its value into a
stable store (`lib/theme-store.ts`); read the theme with `useAppTheme()`, never next-themes'
`useTheme` (a test pins both). e2e: `watchHydration` + `expectNoHydrationErrors`
(`packages/e2e/tests/helpers.ts`) fail on any page error and on a client-generated useId
(`_r_`) inside `<main>`; `hydration.spec.ts` holds React's reveal back to make the race
deterministic. The smoke/e2e wrangler config sets `keep_names: false` like the deploy bundle,
else esbuild's `__name` helper leaks into next-themes' `fn.toString()` inline script.

## Testing

Vitest across `packages/api`, `packages/auth`, `packages/db`, `packages/infra`,
`packages/overlay-kit`, `apps/web`, `apps/server` — run `bun run test`.
Key suites: `packages/api/src/services/__tests__/` (tokens, timer-service, task-service,
twitch-auth), `packages/api/src/routers/__tests__/` (timer-logic, config build/flatten/
round-trip, aliases), `apps/web/src/lib/__tests__/` (timer-utils, task-utils, theme-presets,
config-types, rate-limiter, irc-client, irc-sanitize, server-session, trpc-errors,
api-origin, auth-proxy, bot-session, alias-rows, demo-session), `apps/server/src/lib/__tests__/` (logger
redaction), `packages/auth/src/__tests__/has-owner.test.ts`,
`packages/auth/src/__tests__/create-auth.test.ts` (drives the REAL `createAuth()`: owner
claim, linking refused, owner tokens dropped, openid-only scope, disabled paths plus a
pinned list of every still-routed endpoint (a better-auth bump that adds a route fails
there), the full Twitch OAuth callback with a stubbed token endpoint (first sign-in
claims; a second account redirects to `?error=instance_claimed` — the hook's APIError
must carry `code`, better-auth ≥1.7 reads `body.code`), `DEV_LOGIN` gate, session IP/UA
and expired-session purge),
`packages/db/src/migrations/__tests__/` (data migrations run in sql.js),
`packages/db/src/__tests__/` (`defaults.test.ts`: the frozen column defaults, current
wordings and legacy lists agree key for key, no legacy wording equals a default, every
timer status has a phase label; `provision.test.ts`: `provisionSingletonRows` over real
drizzle + sql.js with every migration applied — one batch, one row per singleton table,
idempotent, tokens never rotate).
**Browser end-to-end** (`packages/e2e`, `bun run e2e`): Playwright drives the real stack — the
api worker from source and the web worker from its built bundle (`bun run build:worker` in
apps/web first), both in local workerd on 127.0.0.1:3000/3001 over a fresh local D1 with every
migration applied (`src/boot-api.ts`, `src/boot-web.ts`), signed in through the `DEV_LOGIN`
bypass with a fixed test secret. One worker and serial specs (single-owner instance, one
database). Spec files are numbered and run in order: `00-first-run` sees the fresh database
(the claim page, then the first dev-login claims the instance), then `10-smoke`,
`15-landing` (the viewer landing: claimed notice + deploy link, docs links, no `/rpc`),
`20-dashboard`, `25-setup-checklist` (confirm/revert a step, Finish later), `30-timer` (Pomodoro start/stop and the ticking timer overlay; phase labels
come from `@dirework/api/config-defaults`), `40-theme-center`, `50-bot-settings`,
`60-token-reset` (the old overlay URL blanks), `70-sign-out`, `80-a11y`, `90-mobile`. Every
spec passes when run twice in a row, because CI retries run immediately against the same
database. Two projects: `chromium` runs all but `90-mobile`; `mobile` (Pixel 7) runs only
`90-mobile` (no horizontal scroll, hamburger nav). `80-a11y` scans with axe-core against
WCAG 2.0/2.1 A and AA, fails on serious/critical violations, attaches the full JSON, and
runs under reduced motion (the entrance fade otherwise skews measured contrast); the Bot
settings scan skips `color-contrast` until its 4.37:1 usage lines are fixed. Shared
helpers in `tests/helpers.ts`: `signIn`, `confirmDialog`, `revealSecretUrl`. Specs use roles
and labels, never CSS classes. Runs in `verify.yml` after the smoke check, so a PR and a
deploy are gated the same way; the Playwright report uploads on failure.
verify's `run-e2e` input (default `true`) skips the suite, never the build: docs deploys pass
`false`, and deploy.yml's `skip_e2e` dispatch input (hotfix only) passes `!skip_e2e`. The
Chromium download is cached on `hashFiles('bun.lock')` (which pins `@playwright/test`); a cache
hit installs only its system libraries (`e2e:install-deps`).
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
declares minimal `permissions`. Dependabot's `bun` ecosystem does edit the root
`catalog` pins, but it bumps packages one at a time, so a family that must move in
lockstep needs a Dependabot group (or a hand bump). `@trpc/*` is pinned exactly in the
catalog and grouped as `trpc` in `.github/dependabot.yml` — `@trpc/client` requires an
exact matching `@trpc/server`, and a lone bump leaves a nested, skewed copy.

`@opennextjs/cloudflare` is pinned exactly (apps/web) and must move with `next`: Next
16.4 reads `.next/server/preview-props.json` at runtime, which OpenNext only bundles from
1.20.12 (under 1.20.9 every request threw `Unexpected loadManifest(...)` in production;
`smoke:worker` now catches that class). OpenNext ≥1.20.10 pulls `@opennextjs/aws` →
`@node-minify/core@9.0.2`, which pins `glob@10.3.3` (GHSA-5j98-mcp5-4vw2, high). That
advisory is ONLY the glob CLI's `-c/--cmd` shell injection; node-minify uses glob as a
library at build time and never runs its CLI, so `audit:dependencies` ignores exactly
that one id (`--ignore=GHSA-5j98-mcp5-4vw2`) — every other advisory still blocks. No
safe override exists: Bun 1.3.x (the CI pin) ignores nested `overrides`, and a top-level
`glob` override would force OpenNext's own `glob@^13` down to 10. Drop the ignore once
an upstream release stops pulling `glob@10.3.3`, or once CI's Bun honours nested
overrides (`"@node-minify/core": { "glob": "10.5.0" }` works on Bun 1.4).

`lucide-react` has two pins: the default catalog (`^1.x`, apps/web) and the named
`catalogs.fumadocs` entry (apps/fumadocs, `catalog:fumadocs`), which must stay on the
range fumadocs-ui 16.5.1 depends on (`^0.563.0`). fumadocs-core takes lucide-react as an
optional peer, so if the docs app's lucide differs from fumadocs-ui's, Bun installs two
fumadocs-core copies and `source` no longer type-checks against fumadocs-ui's
`LoaderOutput` (`docs/[[...slug]]/page.tsx`). Move the docs pin together with a fumadocs
bump (fumadocs-ui moved to lucide 1.x in its later 16.x releases). lucide 1.x dropped brand
icons; brand glyphs are inline SVG components (`apps/web/src/components/icons/`,
`apps/fumadocs/src/components/icons/`).

- `.github/workflows/verify.yml` — **the single verification pipeline**
  (install → dependency audit → design-token drift check → lint → check-types →
  test:coverage → build), called via `workflow_call`. CI and deploy both use it, so the
  deploy gate cannot drift from the PR gate. `build` is skippable via the `run-build`
  input, the Playwright suite via `run-e2e` (see Testing); `upload-docs` also builds and
  uploads the verified docs static export for Pages.
  `audit-blocking` (default `true`): ci.yml keeps the default, so PRs/pushes FAIL on
  high advisories; deploy.yml and deploy-docs-to-pages.yml pass `false`, so the audit
  still runs but only emits a `::warning::` annotation (`continue-on-error`) — an
  advisory published today must never block a revert or hotfix. A test in
  `packages/infra/__tests__/workflow-security.test.ts` pins this split.
  The web app is built with `build:worker` (OpenNext build + wasm fix + static-assets cache
  population) — the exact script Alchemy runs at deploy — so that pipeline fails here,
  not after migrations are applied. Then `smoke:worker` (`apps/web/scripts/smoke-worker.mjs`)
  boots that bundle in local workerd with Alchemy's compatibility date and flags and
  requires 200 from routes that need no api (`/api/version`, both overlays, the bot
  page): a bundle can build and still throw on every request (Next 16.4 under OpenNext
  1.20.9 did, in production — `Unexpected loadManifest(...preview-props.json)`). Between
  `build:worker` and `smoke:worker`, `packages/infra/bundle-budget.ts` checks both Worker
  bundles against `WORKER_BUDGET_KIB` (2560 KiB gzip; the free plan rejects a script over
  3072 KiB compressed, and that rejection would come after the D1 migrations applied): api
  = gzip of the dry-run `apps/server/dist/index.js`, web = `wrangler deploy --dry-run` over
  the OpenNext output with the smoke config plus Alchemy's `minify: true`. Coverage measures every `src/` file
  (`coverage.include`), not just imported ones — except `packages/db`, which measures only
  its two pure modules (`defaults.ts`, `provision.ts`): the schema files are declarative
  drizzle tables and `index.ts` needs the D1 binding. Every package's thresholds sit about
  five points under the measured values (`bun run test:coverage` in the package prints
  them); raise them when coverage rises, never lower them to go green.
- `.github/workflows/codeql.yml` — CodeQL JavaScript/TypeScript analysis plus a separate
  GitHub Actions (workflow) analysis job, both with the `security-extended` query suite on
  pushes, PRs, and a weekly schedule.
- `.github/workflows/audit.yml` — daily + manual: `bun run audit:dependencies` against
  the lockfile, so an advisory published between pushes fails a run and notifies the
  owner.
- `.github/workflows/ci.yml` — push to `dev` + PRs (dev/main): calls `verify.yml`, plus a
  `dependency-review` job on PRs (fails on high-severity advisories). GitHub's
  dependency graph reads only literal `package.json` ranges — not `bun.lock` or
  `catalog:` versions — so `bun audit` (in `verify.yml`) is the real lockfile gate.
  Pushes to `main` are deliberately not a trigger: a push there is a merge, which
  `deploy.yml` (and the docs deploy) already verify, so verify runs twice per merge
  instead of three times; `workflow-security.test.ts` pins the trigger.
- `.github/workflows/uptime.yml` — every 30 minutes + manual, and only when the
  repository variables `UPTIME_API_URL` and `UPTIME_WEB_URL` are set: curls api `/ready`
  and web `/api/version` (2 Worker requests per run, 96 a day; up to 6 per run / 288 a day while both keep
  failing and `--retry 2` fires) and keeps ONE
  `uptime`-labelled issue — opened when either fails, commented on while the outage
  lasts, "Recovered" + closed when both answer. `permissions: {}` at the top and only
  `issues: write` on the job; no checkout, no actions, no secrets (the test pins all of
  it). The free fallback for instances without an external monitor (deployment.mdx →
  Monitoring).
- `.github/workflows/deploy.yml` — push to main (or manual): a `guard` job refuses any ref
  but `refs/heads/main` (`::error title=Deploy refused::`, before verify spends a runner
  half-hour), then `verify.yml` **including the build** (`needs: guard`), then validates
  required secrets/vars, then Alchemy deploy.
  **Deploy runs under Node via the lockfile-pinned local `tsx`
  (`node ./node_modules/.bin/tsx`) — Bun segfaults on the Alchemy program** (same lesson
  as Wolfathon), and `npx -y` would fetch an unpinned tsx at deploy time.
  The deploy job runs in the `production` GitHub environment, and the deploy secrets
  belong there (environment secrets, not repository secrets) so only that job can read
  them. Secrets: `CLOUDFLARE_API_TOKEN`, `ALCHEMY_PASSWORD`, `ALCHEMY_STATE_TOKEN` (**shared
  fleet token** — auths the shared account-wide `alchemy-state` store worker; the shared
  token is what makes sharing safe, a per-app token against it is the "token is invalid"
  clash), `BETTER_AUTH_SECRET`, `PROXY_SECRET` (min 32 chars; signs the forwarded client
  IP — `resolveProxySecret` refuses to invent one outside `--dev`, where it is generated
  per run), `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`. Repository
  **variables**: `BETTER_AUTH_URL`, `CORS_ORIGIN` (required); `DOCS_URL`,
  `PRIVACY_POLICY_URL`, `TERMS_OF_SERVICE_URL` (optional).
  A manual dispatch takes a `force_state_token` input (→ `ALCHEMY_STATE_FORCE_UPDATE`)
  for one-time state-token recovery, and `skip_e2e` (hotfix only → `run-e2e: false`);
  normal push deploys leave both false, so the browser suite always gates a push deploy.
  **`NEXT_PUBLIC_SERVER_URL` is deliberately NOT a deploy variable** — Alchemy injects the
  api worker's resolved URL at build and runtime, so setting it would be dead config.
  The last step is a smoke check (`packages/infra/smoke-check.ts`, logic in `smoke.ts`,
  6×10s polling per probe): api `/ready` must answer 200 with `limits: "ok"` (all four
  rate-limit bindings attached), web `/api/version` must report the deployed commit, web `/`
  must render, redirects not followed (the SSR path, whose session helpers fail closed when
  the api is down): 200 with `DireWork` and `<h1` in the body (claimed), or a redirect to
  same-origin `/setup` that then renders the claim page or answers an Access login
  redirect (unclaimed; any other redirect fails), and
  `GET /rpc/user.me` must refuse an anonymous caller (redirects not followed): 401 through
  the proxy (`ownerProcedure` — the probe that proves the web → api hop; a GET because
  `user.me` is a query), or, when Cloudflare Access fronts `/rpc/*`, a 302/303 to an
  `https://*.cloudflareaccess.com/cdn-cgi/access/login/…` page (`isAccessLoginRedirect`).
  A 200, a 5xx or a redirect anywhere else fails; the success log names which case passed
  for `/` and `/rpc`. Access (account-level, not in this repo) is an extra layer only, never
  a replacement for the owner checks: `/`, `/api/*`, `/bot/*` and `/overlay/*` stay outside
  it, so the api and version probes need no redirect case.
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
- **Observability** — logs (`invocationLogs: false` — Cloudflare's per-request invocation
  logs persist full URLs, and bot/overlay tokens live in URL paths; the app's own redacted
  console JSON still flows) plus Workers Traces at 5% head sampling on both workers.
  Traces record `url.full` on the root span, so a sampled trace can still carry a
  `/bot/<token>` or `/overlay/*/<token>` path; keep trace access as tight as log access.
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
`process.env`, never `NEXT_PUBLIC_`), `DOCS_URL` (the landing page's docs links; same
value as the api worker's), optional `PRIVACY_POLICY_URL` /
`TERMS_OF_SERVICE_URL`, and build-time `NEXT_PUBLIC_DEV_LOGIN` (shows the dev-bypass button).
Deploy also needs the GitHub secrets `ALCHEMY_STATE_TOKEN` and `PROXY_SECRET` (see CI/CD).
`NEXT_PUBLIC_SERVER_URL` is **local-only** — Alchemy injects it in production; never set
it as a GitHub variable. `SKIP_ENV_VALIDATION=true` bypasses t3-env during CI/build and
is baked into the `check-types` scripts so a fresh clone can type-check.

## Code Review Rules

Reviewers (Codex `@codex review`, humans) check every PR against these. Each rule
points at the section above that explains why. Flag a violation as P1 unless noted.

**Free-tier cost budget (Cloudflare Workers free plan + D1).** This deploy must stay
free, so anything that multiplies requests or rows read is a bug, not a style nit:

- No new polling, and no faster interval for an existing poll. Every cadence lives in
  `apps/web/src/lib/poll-intervals.ts`; a change there needs a stated request-budget
  reason. Dashboard queries must keep stopping when the tab is hidden.
- No Workers cron triggers, Durable Objects, Queues, or other paid/metered bindings.
  Prefer doing housekeeping lazily on an existing write path (like
  `purgeExpiredDoneTasks`) or once per deploy (`packages/infra/post-deploy.ts`). A
  GitHub Actions schedule (`uptime.yml`) is not a binding, but it spends Worker requests:
  state the daily count.
- No query on a poll path (overlay, dashboard list, bot ingest) that can scan a whole
  table. New predicates need an index, and the EXPLAIN QUERY PLAN tests must cover them.
- No extra round trips per chat line or per poll (a second D1 query, an extra Worker
  hop, a Twitch call). Public token-gated traffic goes direct to the api worker via
  `publicTrpc`, never through the web proxy.
- Writes on hot paths only when they change something (guarded UPDATEs, `NOT EXISTS`).
- Both Worker bundles stay under `WORKER_BUDGET_KIB` (`packages/infra/bundle-budget.ts`,
  2560 KiB gzip against the free plan's 3072 KiB cap); raising it needs a stated reason.

**Invariants that must not regress:**

- Migrations are expand-only: never drop or rename a column or index that the
  currently deployed worker still uses, and never edit an applied migration.
- Every owner-facing procedure uses `ownerProcedure`; no procedure returns
  `accessToken` / `refreshToken`; the owner's own Twitch tokens are never stored.
- No module-level db/auth/state in workers; use the per-request factories.
- Logs and telemetry never include request bodies, query strings, tokens, error
  messages, or SQL (`logger.ts`, `telemetry.ts`).
- Style values reaching overlay CSS go through the allowlist schemas in
  `config-shared.ts`; chat text is bounded in UTF-8 bytes, not characters.
- Browser traffic that goes web-to-api is proxied by a route handler (`auth-proxy.ts`),
  never a `next.config` rewrite. Server-side renders call the api directly with a
  signed client identity (`lib/server-session.ts`, `stampForwardedClient`) — including
  tRPC prefetches (`lib/server-trpc.ts`), never via `/rpc`; routing them through a
  route handler would add a Worker hop per render.
- Bug fixes come with a test that fails without the fix; SQL-dependent behavior is
  tested against real SQLite (`createSqliteDb`), not mocks.

**Not worth flagging:** formatting and import order (Biome enforces them), and
generated files (`apps/web/public/fonts/*`, migration snapshots, `wrangler.jsonc`).

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
