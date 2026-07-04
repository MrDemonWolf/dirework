# Dirework → Cloudflare Workers Migration

Roadmap for moving Dirework from **Next.js + Node + PostgreSQL + Docker/Coolify** to
**Cloudflare Workers + D1 (SQLite) + Hono**, generated from the target scaffold:

```bash
bun create better-t-stack@latest dirework --frontend next --backend hono \
  --runtime workers --api trpc --auth better-auth --payments none \
  --database sqlite --orm drizzle --db-setup d1 --package-manager bun \
  --no-git --web-deploy cloudflare --server-deploy cloudflare \
  --no-install --addons fumadocs turborepo --examples none
```

## Context

Dirework is a self-hosted Pomodoro + task list with Twitch chat integration for
co-working streams. The current stack is coupled to Node.js (node-postgres Pool,
`process.exit`, `fs`), a persistent Twitch IRC socket (`@twurple/chat`), an in-process
`EventEmitter` bus feeding SSE overlays, and a Docker/Coolify deploy. None of that runs on
Cloudflare Workers.

**Decisions (locked):**
- **Single-tenant per deploy.** Keep the current single-owner architecture (instanceConfig
  singleton, `isOwner` claim, one bot). "Self-host" becomes "deploy to your own Cloudflare".
- **Free plan, no Durable Objects.** Two DO-shaped problems solved without DOs:
  - **Bot → browser.** A token-gated `/bot/<token>` page (OBS browser source or pinned tab,
    same pattern as the Wolfathon overlay token) holds the Twitch IRC-over-WebSocket
    connection (`wss://irc-ws.chat.twitch.tv`). It relays each chat line to a stateless
    `bot.ingest` API procedure that runs the **existing** command logic against D1 and
    returns the reply to send back. Bot is live only while that page is open — acceptable
    for a co-working stream.
  - **Overlays → polling.** Replace SSE subscriptions + EventEmitter with React Query
    `refetchInterval`. Timer computes its countdown locally from `targetEndTime` and only
    re-fetches on phase change. Well under Workers' 100k req/day for realistic stream hours.
- **Frontend regenerated** via `/frontend-design`; **full audit** done — 29 confirmed
  findings in `AUDIT-cloudflare-migration.md`, folded into the port phases (table at the
  bottom of that file). Headline: H1 bot tokens leaked to browser via `user.me`; M1 bot
  handlers duplicate router mutations (fixed by the services extraction the browser-bot
  design needs anyway); M2 `resume()` stuck at 0ms remaining.
- **Fresh scaffold + port** (not in-place): replace the repo tree with the better-t-stack
  layout (apps/server, packages/infra, catalog workspaces), then port Dirework logic in.
- **Bot-account OAuth lives on the Hono server worker** (`/api/bot/authorize` +
  `/api/bot/callback/twitch` become Hono routes) — D1 + auth + Twitch secret in one place.

## Target architecture

```
apps/
  web/        Next 16 (OpenNext) → CF Worker. Dashboard, Theme Center, overlays, /bot page.
  server/     Hono → CF Worker. Mounts tRPC (@hono/trpc-server) + better-auth handler.
  fumadocs/   Docs (static, GitHub Pages) — unchanged except CF deploy rewrite.
packages/
  api/        tRPC routers + pure logic (runtime-agnostic, ported).
  db/         Drizzle SQLite schema + D1 client.
  auth/       better-auth (sqlite provider, D1).
  env/        env access via Wrangler bindings (drop dotenv).
```

Web Worker and API Worker are separate deploys; both bind the same D1 database. D1 is
single-region SQLite — fine for one streamer.

## What carries over vs. gets rebuilt

**Port near-as-is (runtime-agnostic, pure):**
- `packages/api/src/routers/timer-logic.ts` (`computeNextPhase`, `getTimerConfig`, `DEFAULTS`)
- config build/flatten helpers (`buildTimerConfig`/`flattenTimerStyles`/…)
- `apps/web/src/lib/{timer-utils,task-utils,theme-presets,config-types}.ts`
- all Vitest suites for the above
- bot command logic in `packages/api/src/bot/commands.ts` + `handleMessage` (parsing is pure)

**Rewrite / replace:**
- `packages/db/src/index.ts` — `node-postgres` Pool → `drizzle-orm/d1` + D1 binding
- `packages/db/src/migrate.ts` — delete; migrations via `wrangler d1 migrations apply`
- `packages/db/drizzle.config.ts` — dialect `postgresql` → `sqlite`; regenerate migrations
- schema (`auth.ts`, `app.ts`): `pgTable`→`sqliteTable`; `jsonb command_aliases` + `text[] scopes`
  → `TEXT` with app-level JSON (Drizzle `mode:'json'`); `timestamp`→integer/text; `boolean`→
  integer; `doublePrecision`→`real`. (Full column checklist lives in the DB audit output.)
- `packages/auth/src/index.ts` — `provider:'pg'` → `'sqlite'`; D1-backed adapter
- `packages/env/src/server.ts` — drop `dotenv`; read from Wrangler bindings
- tRPC entry — mount under Hono via `@hono/trpc-server`; context gets `db` from the D1 binding
  and `session` from better-auth
- `packages/api/src/events.ts` + `overlay.onTimerState`/`onTaskList` subscriptions + every
  `ee.emit()` — **delete**. Overlay router becomes plain query procedures.
- `packages/api/src/bot/index.ts` `TwitchBotService` (`@twurple/chat`) — **delete**. Replace
  with a `bot.ingest` procedure (server) + a browser IRC client (`/bot` page).
- `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `packages/db/docker-compose.yml`,
  `.dockerignore`, `nixpacks.toml`, `output:"standalone"` — **delete**
- `.github/workflows/ci.yml` + docs deploy — swap Postgres for D1; add `wrangler deploy`

**Build new:**
- `apps/web/wrangler.jsonc` (OpenNext) + `apps/server/wrangler.jsonc` — D1 binding, secrets,
  `nodejs_compat`
- `apps/web/open-next.config.ts`
- `/bot/[token]` page: IRC-over-WebSocket client → `bot.ingest`; owner-gated secret token
  stored on the instance (mirror overlay token model)
- overlay polling hooks (React Query `refetchInterval`); local timer countdown
- regenerated frontend (`/frontend-design`)

## Phased plan

1. **Scaffold** the better-t-stack project (command above) into a scratch dir; study its
   `apps/server` + `apps/web` layout, wrangler configs, tRPC-on-Hono wiring, better-auth-on-D1
   wiring. Restructure this repo to match.
2. **DB** — port schema to SQLite, new D1 client, regenerate migrations, `wrangler d1 create`,
   apply. Port + green the existing db tests.
3. **API** — mount tRPC on Hono; port routers; delete event bus + SSE; convert overlay to
   queries; add `bot.ingest`. Port + green api tests.
4. **Auth** — better-auth on D1; keep Twitch login + bot-account OAuth callback (now Hono routes).
5. **Bot page** — `/bot/[token]` IRC WS client + relay. Verify a chat command mutates D1.
6. **Overlays** — swap subscriptions for polling; local timer countdown; verify in OBS/browser.
7. **Frontend regen** — `/frontend-design` for dashboard/Theme Center/bot settings/overlays,
   folding in the audit's UI/UX findings. Reuse the pure lib helpers + theme presets.
8. **Deploy** — wrangler for both workers; secrets; CI rewrite; docs rewrite (Deployment page
   becomes a Cloudflare guide, drop Docker/Coolify).
9. **Audit fixes** — apply confirmed carry-over bugs, dedupe, and security findings during the
   port (don't reproduce them).

## Free-tier notes

- Workers Free: 100k req/day. Overlays poll only while OBS/stream is live; a 6h stream at 2–3s
  polling ≈ 15–25k/day. Bot ingest scales with chat volume. Comfortable margin.
- D1 Free: 5M reads/day, 100k writes/day, 5GB. Single streamer — negligible.
- If limits are ever hit: raise poll interval, batch ingest, or move to the $5 Workers paid
  plan (then a Durable Object bot/real-time becomes an option). Not needed at launch.

## Verification

- `bun run check-types` + `bun run test` green across packages after each phase.
- `wrangler dev` (server) + `wrangler dev`/OpenNext (web) locally against a local D1.
- End-to-end: Twitch login → claim instance → connect bot account → open `/bot` page →
  type `!task write docs` in chat → task appears in dashboard + task overlay → start timer →
  timer overlay counts down and updates on phase change.
- Deploy both workers; repeat the e2e against the deployed URLs.

## Scaffold reference (validated against `bun create better-t-stack`)

The target scaffold was generated and studied. Exact idioms to follow when porting:

- **Deploy = Alchemy** (IaC), not raw wrangler — same tool as Wolfathon. `packages/infra/alchemy.run.ts`
  declares `D1Database("database",{migrationsDir})`, `Worker("server",{cwd:"apps/server",
  entrypoint:"src/index.ts",compatibility:"node",url:true,bindings:{DB, CORS_ORIGIN,
  BETTER_AUTH_SECRET:alchemy.secret.env..., BETTER_AUTH_URL}})`, and `Nextjs("web",{cwd:"apps/web",
  bindings:{NEXT_PUBLIC_SERVER_URL:server.url, DB, ...}})`. Root scripts `deploy`/`destroy` →
  `turbo -F @dirework/infra`. Dev via `bun run dev` (alchemy dev).
- **Per-request factories, NO module singletons** (Workers isolate per request):
  - `createDb() = drizzle(env.DB, { schema })`
  - `createAuth() = betterAuth({ database: drizzleAdapter(createDb(), { provider:"sqlite", schema }), ... })`
  - `createContext({ context /* Hono ctx */ }) → { session: await createAuth().api.getSession({headers}), db: createDb() }`
  - **Delete** Dirework's module-level `db`, `auth`, `ee` (EventEmitter), `botService` singletons.
- **Env split**: server = `export { env } from "cloudflare:workers"` (bindings typed in
  `packages/env/env.d.ts`); web client = t3-env `NEXT_PUBLIC_SERVER_URL`; local/scripts =
  `cloudflare-local.ts` dotenv Proxy. Drop the current `dotenv/config` + `process.env` server env.
- **Hono server** (`apps/server/src/index.ts`): `cors({origin:env.CORS_ORIGIN, credentials:true})`;
  `app.on(["POST","GET"],"/api/auth/*", c => createAuth().handler(c.req.raw))`;
  `app.use("/trpc/*", trpcServer({ router: appRouter, createContext:(_o,context)=>createContext({context}) }))`.
  Build via `tsdown`. Bot-account OAuth (`/api/bot/authorize|callback/twitch`) moves here (has D1 + auth).
- **tRPC client** (`apps/web/src/utils/trpc.ts`): single `httpBatchLink({url:`${NEXT_PUBLIC_SERVER_URL}/trpc`,
  fetch → credentials:"include"})` + `createTRPCOptionsProxy`. **No** splitLink/httpSubscriptionLink.
- **OpenNext**: `next.config.ts` → `{typedRoutes:true, reactCompiler:true}` + `initOpenNextCloudflareForDev()`;
  `open-next.config.ts` → `defineCloudflareConfig({})`. Remove `output:"standalone"`.
- **SQLite column idioms** (mirror `packages/db/src/schema/auth.ts`):
  bool → `integer(c,{mode:"boolean"})`; timestamp →
  `integer(c,{mode:"timestamp_ms"}).default(sql`(cast(unixepoch('subsecond')*1000 as integer))`)`
  + `.$onUpdate(()=>new Date())`; jsonb/`text[]` → `text(c,{mode:"json"}).$type<T>()`;
  id → `text().primaryKey().$defaultFn(()=>createId())`. `onConflictDoNothing()` works in SQLite.
- **drizzle-kit**: `dialect:"sqlite", driver:"d1-http"`, `out:"./src/migrations"`; Alchemy applies via `migrationsDir`.
- **Auth cross-origin cookies**: `advanced.defaultCookieAttributes:{sameSite:"none",secure:true,httpOnly:true}`;
  for `*.workers.dev` enable `session.cookieCache` + `crossSubDomainCookies` (commented hints in scaffold).
- **Root**: bun workspaces + a **catalog** for shared dep versions; `packageManager: bun@1.3.14`.

## Open items (post-scaffold)

- Add `socialProviders.twitch` to `createAuth()` (scaffold ships email/password; Dirework's Twitch
  config ports over). Keep the bot-account second OAuth flow.
- `packages/ui`: scaffold extracts UI into a package; Dirework keeps `ui` in `apps/web`. Keep
  Dirework's layout unless the `/frontend-design` regen benefits from the package.
- Bot chat-token refresh: browser hits a server endpoint that holds the Twitch client secret;
  browser only ever sees the short-lived chat token.
- D1 is single-region SQLite — fine for single-tenant; note it.
