# CLAUDE.md

This file provides guidance for Claude Code when working on the Dirework codebase.

## Project Overview

Dirework is a self-hosted Pomodoro timer and task list with Twitch chat integration, designed for co-working and body-doubling streams. Single-user per instance. Streamers login with Twitch, connect a bot account, configure OBS overlays, and viewers interact via chat commands.

## Monorepo Structure

Turborepo + pnpm workspaces. All packages use ESM (`"type": "module"`).

```
apps/web           → Next.js 16 app (frontend + API), port 3001
apps/fumadocs      → Fumadocs documentation site, port 4000
packages/api       → tRPC routers + business logic
packages/auth      → Better Auth configuration (Twitch OAuth)
packages/db        → Prisma schema + client (PostgreSQL)
packages/env       → t3-env environment variable validation
packages/config    → Shared TypeScript configuration
```

## Commands

```bash
pnpm dev              # Start all apps (web + docs)
pnpm build            # Build all apps for production
pnpm check-types      # TypeScript type checking across all packages
pnpm dev:web          # Web app only
pnpm dev:native       # Native app only
pnpm db:start         # Start PostgreSQL via Docker
pnpm db:stop          # Stop PostgreSQL
pnpm db:down          # Tear down database completely
pnpm db:push          # Push Prisma schema to database
pnpm db:generate      # Regenerate Prisma client
pnpm db:studio        # Open Prisma Studio
pnpm db:migrate       # Run Prisma migrations
pnpm db:watch         # Watch database changes
```

## Tech Stack

- **Next.js 16** (App Router) with React 19, React Compiler, and typed routes enabled
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **shadcn/ui** (base-lyra style) with Lucide icons
- **tRPC v11** with httpBatchLink and `createTRPCOptionsProxy` for type-safe API
- **TanStack React Query** for client-side data fetching
- **TanStack React Form** for form handling
- **Better Auth** with Twitch social provider (30-day sessions)
- **Prisma 7** with PostgreSQL 17 (Docker) and `@prisma/adapter-pg`
- **Sonner** for toast notifications
- **next-themes** for dark/light mode
- **Google Fonts** — Montserrat (headings/timer) + Roboto (body text)
- **Fumadocs** with Orama search for documentation
- **TypeScript 5** in strict mode everywhere

## Code Patterns

### Imports & Aliases

The web app uses `@/` mapping to `apps/web/src/`:
- `@/components` — React components
- `@/components/ui` — shadcn/ui primitives
- `@/components/theme-center` — Theme Center editor components
- `@/lib` — utilities (auth-client, cn helper, config-types, deep-merge, theme-presets)
- `@/utils` — tRPC client setup

Internal packages are imported as `@dirework/api`, `@dirework/auth`, `@dirework/db`, `@dirework/env`.

### Component Conventions

- Functional components only, PascalCase names
- `"use client"` directive on all interactive components
- Server components only for auth checks and data loading (e.g., `dashboard/page.tsx`)
- Styling via Tailwind utility classes + CSS variables for theming
- Class merging with `clsx` + `tailwind-merge` via `cn()` helper
- Components using `useSearchParams` must be wrapped in `<Suspense>` in their parent server component

### Next.js Typed Routes

Next.js typed routes are enabled. When using `Link` with dynamic `href` from arrays/objects, use `as const` on literal route strings to preserve the type:
```tsx
const navItems = [
  { href: "/dashboard" as const, label: "Dashboard" },
];
// <Link href={item.href}> works because href is a string literal type
```

### Fonts

- **Montserrat** — used for headings (`font-heading` CSS class / `--font-heading` variable) and timer display text
- **Roboto** — used for body text (`font-sans` / `--font-roboto` variable)
- Loaded via `next/font/google` in root layout; overlay layout loads via Google Fonts CDN `<link>` tag

### API Layer (tRPC)

Routers live in `packages/api/src/routers/`. Two procedure types:
- `publicProcedure` — no auth required (used by overlays)
- `protectedProcedure` — throws UNAUTHORIZED if no session

Router structure: `user`, `task`, `timer`, `config`, `overlay`.

Context provides `session` (from Better Auth) and `prisma` client.

### Database

Prisma schema split across files in `packages/db/prisma/schema/`:
- `schema.prisma` — generator + datasource config
- `auth.prisma` — User, Session, Account, Verification (Better Auth managed)
- `app.prisma` — BotAccount, Task, TimerState, Config (app-specific)

Key conventions:
- Table names use `@map("snake_case")`
- IDs use `@default(cuid())`
- User model extended with `twitchId`, `displayName`, overlay tokens
- Tasks have priority system: 0 = broadcaster (pinned top), 1 = viewers
- TimerState is a state machine: idle → starting → work → break → longBreak → paused → finished
- Config stores JSON blobs for timer settings, styles, messages, command aliases

### Authentication

- Better Auth handles Twitch OAuth login
- Bot account connection is a separate OAuth flow via `/api/bot/authorize` → `/api/bot/callback`
- Bot callback includes error reason in redirect query params for user-facing toast notifications
- Overlay access uses UUID tokens (no auth needed), regenerable per user

### Overlay System

Public routes at `/overlay/t/[token]` (timer) and `/overlay/l/[token]` (task list). Transparent backgrounds for OBS browser sources. Poll via React Query refetch intervals (1-2 seconds).

Timer overlay supports two progress ring shapes:
- **Circle** — standard SVG `<circle>` with `strokeDasharray`/`strokeDashoffset`
- **Rounded rectangle (squircle)** — SVG `<rect>` with configurable `borderRadius`, macOS-style (default 22%)

Overlays use saved user config (deep-merged with defaults) for styling. Config is fetched via `trpc.overlay.*` public procedures.

### Theme Center (`/dashboard/styles`)

Two-column layout: editor (left) + live preview (right).

Key files:
- `src/lib/config-types.ts` — TypeScript interfaces for `TimerStylesConfig` and `TaskStylesConfig`
- `src/lib/deep-merge.ts` — Generic deep merge utility for merging saved config with defaults
- `src/lib/theme-presets.ts` — 11 theme presets + default style objects
- `src/components/theme-center/` — All editor components (ThemeBrowser, ThemeCard, TimerStyleEditor, TaskStyleEditor, ColorInput, FontSelect, SectionGroup, StylePreviewPanel)
- `src/app/(app)/dashboard/styles/` — Page and client component

Theme presets (11 total): Default, Liquid Glass Light, Liquid Glass Dark, Neon Cyberpunk, Cozy Cottage, Ocean Depths, Sakura, Retro Terminal, Minimal Light, Sunset, Twitch Purple.

Data flow:
1. Load saved config via `trpc.config.get`
2. Deep-merge with defaults into working state
3. Theme "Apply" or editor changes update working state (instant preview)
4. "Save" calls existing `config.updateTimerStyles` + `config.updateTaskStyles` mutations
5. No database schema changes needed

### Dashboard

- Time-of-day greetings (morning/afternoon/evening/night) with `suppressHydrationWarning`
- Overlay previews use iframes pointing to actual overlay pages (`/overlay/t/[token]` and `/overlay/l/[token]`)
- Bot connection feedback via URL search params (`?bot=connected` or `?bot=error&reason=...`) with toast notifications

## Deployment

Deployed via **Coolify** using **Nixpacks** build pack. Config in `nixpacks.toml`.

- Next.js uses `output: "standalone"` for containerized deployment
- `SKIP_ENV_VALIDATION=true` is set at build time to bypass t3-env validation (runtime secrets aren't available during build)
- Nixpacks build: install deps → generate Prisma client → build Next.js → copy static assets
- Start command: `node apps/web/.next/standalone/apps/web/server.js`
- PostgreSQL 17 Alpine as a separate Coolify service
- Instance-specific notes live in `coolify.md` (gitignored)
- Environment variable reference in `.env.example`

## Git Workflow

- `main` — production branch
- `dev` — development branch
- Work on `dev`, PR to `main` for releases

## Environment Variables

Defined in `packages/env/src/server.ts`. Required:
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — min 32 characters
- `BETTER_AUTH_URL` — app URL (e.g., `http://localhost:3001`)
- `CORS_ORIGIN` — allowed CORS origin
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — from dev.twitch.tv

Optional:
- `ALLOWED_TWITCH_IDS` — comma-separated allowlist (empty = allow all)
- `NODE_ENV` — development/production/test
- `SKIP_ENV_VALIDATION` — set to `"true"` during CI/build to skip env validation

## README Convention

The README follows the MrDemonWolf format (see `mrdemonwolf/fluffboost` for reference). Section order: Title with tagline, Description, Features, Getting Started, Usage, Tech Stack, Development (Prerequisites, Setup, Scripts, Code Quality), Project Structure, License badge, Contact, Footer. No emojis. Bold feature names. Aligned tables. Code blocks with language tags.
