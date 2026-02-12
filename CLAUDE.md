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
pnpm test             # Run Vitest unit tests across all packages
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
- **tRPC v11** with httpBatchLink, httpSubscriptionLink (SSE), splitLink, and `createTRPCOptionsProxy` for type-safe API
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
- `@/components/ui` — shadcn/ui primitives (button, input, label, dropdown-menu, tooltip, tabs, etc.)
- `@/components/theme-center` — Theme Center editor components
- `@/lib` — utilities (auth-client, cn helper, config-types, theme-presets)
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
- `app.prisma` — BotAccount, Task, TimerState, TimerConfig, TimerStyle, TaskStyle, BotConfig (app-specific)

Key conventions:
- Table names use `@map("snake_case")`
- IDs use `@default(cuid())`
- User model extended with `twitchId`, `displayName`, overlay tokens
- Tasks have priority system: 0 = broadcaster (pinned top), 1 = viewers
- TimerState is a state machine: idle → starting → work → break → longBreak → paused → finished

Database architecture uses 4 focused config models instead of one monolithic table:
- `TimerConfig` — timer durations, cycles, behavior flags, phase labels (17 columns)
- `TimerStyle` — timer overlay appearance: dimensions, ring, colors, fonts (21 columns)
- `TaskStyle` — task list overlay appearance: header, body, items, checkboxes, bullets (57 columns)
- `BotConfig` — bot toggles, command aliases (Json), task messages (18), timer messages (14)

All columns have Prisma `@default()` values — row creation only requires `{ userId }`. Records are lazily provisioned on first access via `ensureUserConfig()` in the config router.

The API layer maps flat DB columns to nested frontend objects via build helpers (`buildTimerConfig`, `buildTimerStylesConfig`, `buildTaskStylesConfig`, `buildBotConfig`) and flattens writes via `flattenTimerStyles`/`flattenTaskStyles`.

### Authentication

- Better Auth handles Twitch OAuth login
- Bot account connection is a separate OAuth flow via `/api/bot/authorize` → `/api/bot/callback`
- Bot callback includes error reason in redirect query params for user-facing toast notifications
- Overlay access uses UUID tokens (no auth needed), regenerable per user

### Overlay System

Public routes at `/overlay/t/[token]` (timer) and `/overlay/l/[token]` (task list). Transparent backgrounds for OBS browser sources. Overlays use **Server-Sent Events (SSE)** via tRPC subscriptions for real-time updates (replaces polling).

SSE infrastructure:
- `packages/api/src/events.ts` — in-process `EventEmitter` bus emitting `timerStateChange:{userId}` and `taskListChange:{userId}` events
- `trpc.overlay.onTimerState` / `trpc.overlay.onTaskList` — SSE subscription procedures that yield initial state then stream changes
- `apps/web/src/utils/trpc.ts` — `splitLink` routes subscriptions to `httpSubscriptionLink`, queries/mutations to `httpBatchLink`
- Task and timer mutations emit events after DB writes; overlay subscriptions listen and push fresh data

Timer overlay supports two progress ring shapes:
- **Circle** — standard SVG `<circle>` with `strokeDasharray`/`strokeDashoffset`
- **Rounded rectangle (squircle)** — SVG `<rect>` with configurable `borderRadius`, macOS-style (default 22%)

Overlays receive pre-built nested config objects from `trpc.overlay.*` public procedures — no client-side merging needed.

Task list overlay groups tasks by author — each author gets a styled card container with a tinted header row showing their name and done/total count. Individual tasks render inside the container. Grouping uses `authorTwitchId` (falls back to `authorDisplayName`). Component: `src/components/task-list-display.tsx`.

### Theme Center (`/dashboard/styles`)

Two-column layout: editor (left) + live preview (right).

Key files:
- `src/lib/config-types.ts` — TypeScript interfaces for `TimerStylesConfig`, `TaskStylesConfig`, `TimerConfigData`, `BotConfigData`, `AppConfig`
- `src/lib/theme-presets.ts` — 11 theme presets + default style objects
- `src/components/theme-center/` — All editor components (ThemeBrowser, ThemeCard, TimerStyleEditor, TaskStyleEditor, PhaseLabelsEditor, ColorInput, FontSelect, SectionGroup, StylePreviewPanel)
- `src/app/(app)/dashboard/styles/` — Page and client component

Theme presets (11 total): Default, Liquid Glass Light, Liquid Glass Dark, Neon Cyberpunk, Cozy Cottage, Ocean Depths, Sakura, Retro Terminal, Minimal Light, Sunset, Twitch Purple.

Data flow:
1. Load saved config via `trpc.config.get` — returns pre-built nested `{ timerConfig, timerStyles, taskStyles, botConfig }`
2. Theme "Apply" or editor changes update working state (instant preview)
3. "Save" calls `config.updateTimerStyles` + `config.updateTaskStyles` + `config.updatePhaseLabels` mutations
4. API flattens nested objects back to flat DB columns via `flattenTimerStyles`/`flattenTaskStyles`

Phase Labels editor lives in the Timer tab (moved from Bot Settings — it's a timer display concern, not a bot concern). Style preview panel includes a timer animation toggle (play/pause) for live countdown simulation. Task list respects `scroll.enabled` toggle to switch between infinite scroll and static overflow.

### Dashboard

- Time-of-day greetings (morning/afternoon/evening/night) with `suppressHydrationWarning`
- Overlay previews use iframes pointing to actual overlay pages (`/overlay/t/[token]` and `/overlay/l/[token]`)
- Bot connection feedback via URL search params (`?bot=connected` or `?bot=error&reason=...`) with toast notifications
- Task manager groups tasks by author with per-author pending/done counts. Component: `src/components/task-manager.tsx`

### Bot Settings (`/dashboard/bot`)

Two-column responsive layout (`max-w-5xl`):
- **Left column** (sticky sidebar, `lg:w-80`): Bot Account card, Task/Timer command toggle cards, Command Aliases editor
- **Right column** (scrollable): Task Messages + Variable Reference, Timer Messages + Variable Reference
- Collapses to single column on mobile (`< lg`)
- Components in `src/components/bot-settings/` (message-editor, command-alias-editor, variable-reference)
- Bot callback redirects use `env.BETTER_AUTH_URL` instead of `request.url` for correct behavior behind reverse proxies

### Hydration Safety

- Components depending on client-only state (e.g., `next-themes` resolved theme) must use a `mounted` state pattern to avoid hydration mismatches
- Render a placeholder during SSR, swap to real content after `useEffect` mount
- When using controlled components (e.g., Base UI Switch), always pass the controlled prop (e.g., `checked={false}`) even in the pre-mount placeholder to avoid uncontrolled-to-controlled warnings

## Deployment

### Web App (Coolify)

Deployed via **Coolify** using **Dockerfile**. Config in `Dockerfile` + `docker-entrypoint.sh`.

- Next.js uses `output: "standalone"` for containerized deployment
- `SKIP_ENV_VALIDATION=true` is set at build time to bypass t3-env validation (runtime secrets aren't available during build)
- Docker build: install deps → generate Prisma client → build Next.js → copy static assets
- Start command: `node apps/web/.next/standalone/apps/web/server.js`
- PostgreSQL 17 Alpine as a separate Coolify service
- Instance-specific notes live in `coolify.md` (gitignored)
- Environment variable reference in `.env.example`

### Documentation (GitHub Pages)

Deployed via **GitHub Actions** to **GitHub Pages**. Workflow in `.github/workflows/deploy-docs-to-pages.yml`.

- Triggers on push to `main` branch
- Fumadocs uses `output: "export"` for static site generation
- `basePath` is set dynamically via `NEXT_PUBLIC_BASE_PATH` env var from `actions/configure-pages` (resolves to `/dirework` for GitHub Pages subpath)
- Workflow: install deps → build fumadocs → upload to GitHub Pages
- Uses ocean (blue) color preset (`fumadocs-ui/css/ocean.css`)
- GitHub link in nav bar via `githubUrl` in shared layout options

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

## Footer Convention

Both the web app and docs site use the same footer format:
`© {year} DireWork by MrDemonWolf, Inc.` — both names are links (no underline, font-medium, hover highlight). "DireWork" links to the GitHub repo, "MrDemonWolf, Inc." links to mrdemonwolf.com.

- Web app: inline in `apps/web/src/app/(app)/layout.tsx`
- Docs: shared `Footer` component in `apps/fumadocs/src/components/footer.tsx`, rendered from root layout

## README Convention

The README follows the MrDemonWolf format (see `mrdemonwolf/fluffboost` for reference). Section order: Title with tagline, Description, Features, Getting Started, Usage, Tech Stack, Development (Prerequisites, Setup, Scripts, Code Quality), Project Structure, License badge, Contact, Footer. No emojis. Bold feature names. Aligned tables. Code blocks with language tags.
