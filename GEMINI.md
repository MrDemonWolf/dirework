# Dirework - Gemini CLI Instructions

This document provides foundational mandates and contextual guidance for Gemini CLI when working on the Dirework codebase.

## Project Overview
Dirework is a self-hosted, single-user Pomodoro timer and task list designed for Twitch co-working and body-doubling streams. It features real-time OBS overlays, Twitch chat integration via a dedicated bot account, and extensive theme customization.

### Monorepo Structure (Turborepo + Bun/pnpm Workspaces)
- **`apps/web`**: Next.js 16 app (frontend + API), port 3001.
- **`apps/fumadocs`**: Documentation site built with Fumadocs, port 4000.
- **`packages/api`**: tRPC routers and business logic.
- **`packages/auth`**: Better Auth configuration for Twitch OAuth.
- **`packages/db`**: Drizzle ORM schema, migrations, and client (PostgreSQL).
- **`packages/env`**: Environment variable validation using `t3-env`.
- **`packages/config`**: Shared TypeScript and tooling configuration.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui.
- **API**: tRPC v11 with SSE (Server-Sent Events) for real-time overlay subscriptions.
- **Data Fetching**: TanStack React Query & React Form.
- **Authentication**: Better Auth with Twitch Social Provider.
- **Database**: PostgreSQL 17 + Drizzle ORM.
- **Real-time**: In-process `EventEmitter` for streaming updates to overlays via SSE.
- **Documentation**: Fumadocs with Orama search.

## Building and Running

### Development
```bash
pnpm install          # Install dependencies
pnpm db:start         # Start PostgreSQL (Docker)
pnpm db:push          # Push Drizzle schema to DB
pnpm dev              # Start all apps (web + docs)
pnpm dev:web          # Start web app only (port 3001)
```

### Database Management
```bash
bun run db:generate   # Generate a new migration
bun run db:migrate    # Apply migrations
bun run db:studio     # Open Drizzle Studio
```

### Verification
```bash
pnpm check-types      # TypeScript type checking
pnpm test             # Run Vitest unit tests
pnpm build            # Build all apps for production
```

## Development Conventions

### Coding Style
- **Components**: Functional components only, PascalCase names. Use `"use client"` where interactivity is required.
- **Imports**: 
  - Use `@/` for `apps/web/src/`.
  - Internal packages: `@dirework/api`, `@dirework/auth`, `@dirework/db`, `@dirework/env`.
- **Styling**: Tailwind utility classes + CSS variables for theming. Use `cn()` helper for class merging.
- **Next.js Typed Routes**: Enabled. Use `as const` for literal route strings in `Link` components.

### API & Data Flow
- **tRPC Routers**: Located in `packages/api/src/routers/`.
- **Procedures**: `publicProcedure` (overlays/no-auth) vs. `protectedProcedure` (dashboard/auth-required).
- **SSE Subscriptions**: Used for real-time overlay updates (Timer/Task list).
- **State Machine**: Timer logic is handled as a state machine (`idle` → `starting` → `work` → etc.) in `timer-logic.ts`.

### Database & Schema
- **Conventions**: Snake_case for DB columns, camelCase for TypeScript fields.
- **IDs**: CUID2 generated using `createId()`.
- **Schema**: Split by domain (`auth.ts`, `app.ts`) in `packages/db/src/schema/`.
- **Config Models**: Config is split into focused models (`timerConfig`, `timerStyle`, `taskStyle`, `botConfig`) to avoid monolithic tables.

### Testing
- **Vitest**: Unit tests cover core logic (timer machine, display helpers, task grouping).
- **Standard**: Extract pure logic into testable modules (`timer-logic.ts`, `timer-utils.ts`) instead of inlining in components.

## Security & Environment
- **Validation**: Environment variables are strictly validated via `packages/env`.
- **Builds**: `SKIP_ENV_VALIDATION=true` must be set during CI and Docker builds.
- **Secrets**: Never commit `.env` files or expose `BETTER_AUTH_SECRET`, `DATABASE_URL`, or Twitch credentials.

## Deployment
- **Web App**: Deployed via Docker (standalone Next.js output) on Coolify.
- **Documentation**: Statis export deployed to GitHub Pages via GitHub Actions.
