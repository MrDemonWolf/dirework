# Dirework - Gemini CLI Instructions

This document provides foundational mandates and contextual guidance for Gemini CLI when working on the Dirework codebase. It mirrors `CLAUDE.md`; consult that file for the full detail.

## Project Overview
Dirework is a self-hosted, single-user Pomodoro timer and task list designed for Twitch co-working and body-doubling streams. It features OBS overlays, Twitch chat integration via a dedicated bot account, and extensive theme customization. It runs entirely on Cloudflare Workers + D1 (free plan — no Durable Objects), one deploy per streamer.

### Monorepo Structure (Turborepo + Bun Workspaces)
- **`apps/web`**: Next.js 16 web worker via OpenNext on Cloudflare (dashboard, Theme Center, overlays, bot page — NOT the API), port 3001.
- **`apps/server`**: Hono API worker — mounts better-auth (`/api/auth/*`), tRPC (`/trpc/*`), bot OAuth (`/api/bot/*`), and `/health`, port 3000.
- **`apps/fumadocs`**: Documentation site built with Fumadocs, port 4000.
- **`packages/api`**: tRPC routers, services, and bot command logic.
- **`packages/auth`**: Better Auth configuration for Twitch OAuth (`createAuth()` factory).
- **`packages/db`**: Drizzle ORM schema, migrations, and `createDb()` client (Cloudflare D1 / SQLite, via `drizzle-orm/d1`).
- **`packages/env`**: Environment bindings (`cloudflare:workers` for the server, t3-env for the web).
- **`packages/infra`**: Alchemy infrastructure-as-code (both workers + D1).
- **`packages/config`**: Shared TypeScript and tooling configuration.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui.
- **API**: tRPC v11 mounted on a Hono API worker (`@hono/trpc-server`); the browser reaches it same-origin via a Next.js rewrite proxy (`/rpc/*` → api `/trpc/*`).
- **Data Fetching**: TanStack React Query (polling via `refetchInterval`).
- **Authentication**: Better Auth with Twitch Social Provider.
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM (`drizzle-orm/d1`); migrations applied by Alchemy.
- **Real-time**: Polling — overlays poll public tRPC queries every 2s and tick the countdown locally from `targetEndTime`. There is no SSE, no EventEmitter/event bus.
- **Documentation**: Fumadocs with Orama search.

## Building and Running

### Development
```bash
bun install           # Install dependencies (Bun workspaces)
bun run dev           # Alchemy dev: api worker :3000 + web :3001 + local D1 (migrations applied)
bun run dev:web       # Web app only (port 3001)
bun run dev:server    # API worker only (port 3000)
```

Local env lives in `packages/infra/.env` (mirrored to `apps/web/.env` and `apps/server/.env`); copy `.env.example` to get started. No Docker or PostgreSQL is involved.

### Database Management
```bash
bun run db:generate   # Generate a Drizzle migration from schema changes
```
Migrations are applied automatically by Alchemy on `bun run dev` and on deploy — there is no separate `db:push`/`db:migrate`/`db:studio` step.

### Verification / Deploy
```bash
bun run check-types   # TypeScript type checking across all packages
bun run test          # Vitest unit tests
bun run build         # Build all apps
bun run deploy        # Alchemy deploy (both workers + D1)
```

## Development Conventions

### Coding Style
- **Components**: Functional components only, PascalCase names. Use `"use client"` where interactivity is required.
- **Imports**:
  - Use `@/` for `apps/web/src/`.
  - Internal packages: `@dirework/api`, `@dirework/auth`, `@dirework/db`, `@dirework/env`.
- **Styling**: Tailwind utility classes + CSS variables for theming. Use `cn()` helper for class merging.
- **Next.js Typed Routes**: Enabled. Use `as const` for literal route strings in `Link` components.
- **Per-request factories**: Workers isolate per request — use `createDb()`, `createAuth()`, `createContext()`. Never add module-level db/auth/EventEmitter singletons.

### API & Data Flow
- **tRPC Routers**: Located in `packages/api/src/routers/`.
- **Procedures**: `publicProcedure` (overlays + bot page, token-gated) vs. `protectedProcedure` (session-required).
- **Services own mutations**: `packages/api/src/services/` — both tRPC routers and `bot.ingest` call the same service functions; never duplicate mutation logic.
- **Polling**: Overlays poll public tRPC queries (`overlay.getTimerState` / `getTaskList`) every 2s via `publicTrpc` and compute the countdown locally from `targetEndTime` — no SSE.
- **State Machine**: Timer logic is a state machine (`idle` → `starting` → `work` → etc.) in `timer-logic.ts` (pure, env-free).

### Database & Schema
- **Conventions**: Snake_case for DB columns, camelCase for TypeScript fields.
- **IDs**: CUID2 generated using `createId()`.
- **Schema**: Split by domain (`auth.ts`, `app.ts`, relations in `index.ts`) in `packages/db/src/schema/`.
- **Config Models**: Config is split into focused singleton models (`timerConfig`, `timerStyle`, `taskStyle`, `botConfig`) with column defaults, lazily provisioned on first access.

### Testing
- **Vitest**: Unit tests cover core logic (timer machine, task/timer services, config build/flatten/round-trip, display helpers, token verification).
- **Standard**: Extract pure logic into testable modules (`timer-logic.ts`, `timer-utils.ts`) instead of inlining in components. Pure modules must not import `@dirework/env/server`.

## Security & Environment
- **Validation**: Server-worker env comes from `cloudflare:workers` bindings, typed in `packages/env/env.d.ts` (generated from `packages/infra/alchemy.run.ts`); t3-env only validates the web worker's `NEXT_PUBLIC_SERVER_URL`.
- **Builds**: `SKIP_ENV_VALIDATION=true` bypasses web-worker env validation during CI and build.
- **Secrets**: Never commit `.env` files or expose `BETTER_AUTH_SECRET` or the Twitch credentials (`TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`). Deploy-only secrets `CLOUDFLARE_API_TOKEN` and `ALCHEMY_PASSWORD` must also stay out of source control. There is no `DATABASE_URL` — the database is a Cloudflare D1 binding (`DB`).

## Deployment
- **Workers**: Both workers deploy to Cloudflare via Alchemy (`bun run deploy` → `packages/infra/alchemy.run.ts`, run under Node via `tsx` — Bun segfaults on the Alchemy program); CI deploys on push to `main` (`.github/workflows/deploy.yml`). Production: `dirework.mrdemonwolf.workers.dev` (web) + `dirework-api.mrdemonwolf.workers.dev` (api) + `dirework-db` (D1). There is no Docker/Coolify path.
- **Documentation**: Static Fumadocs export deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy-docs-to-pages.yml`).
