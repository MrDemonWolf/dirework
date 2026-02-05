# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dirework is an open-source, self-hosted Pomodoro timer and task list with Twitch chat integration. Streamers deploy their own instance, log in with Twitch, connect a bot account, and add OBS overlays that respond to chat commands. Full architecture and implementation phases are in `PLAN.md`.

## Tech Stack

- **Frontend:** Next.js (App Router) in `apps/web/` (source in `src/`)
- **Backend:** Convex (**self-hosted** on Coolify, not Convex Cloud) in `packages/backend/convex/`
- **Auth:** better-auth with `@convex-dev/better-auth` adapter, Twitch OAuth provider
- **Chat Bot:** tmi.js running inside overlay browser sources (bot-in-overlay model)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) for all UI components, Tailwind CSS
- **Documentation:** Fumadocs in `apps/fumadocs/`
- **Monorepo:** Turborepo + pnpm workspaces
- **Deployment:** Coolify (Docker Compose), self-hosted
- **Theme:** Light and dark mode support (system default via next-themes)

## Scaffolding

Project scaffolded with `create-better-t-stack`. Key workspace packages:
- `@dirework/backend` — Convex backend (`packages/backend/`)
- `@dirework/env` — environment variable validation via t3-env (`packages/env/`)
- `@dirework/config` — shared TypeScript config (`packages/config/`)

## Architecture

### Bot-in-Overlay Model

The Twitch bot runs **inside each overlay** (OBS browser source), not as a separate service. Each overlay connects to Twitch chat via tmi.js and handles its own commands. Timer overlay handles `timer:*` actions, task overlay handles `task:*` actions.

### Key Data Flow

1. Streamer authenticates via Twitch OAuth (better-auth)
2. Streamer connects a separate bot Twitch account via `/auth/twitch/bot`
3. Overlay pages (`/overlay/t/[token]`, `/overlay/l/[token]`) fetch bot credentials using their token
4. Overlays connect to Twitch IRC and handle commands, updating Convex in real-time
5. Timer uses server-authoritative `targetEndTime` with Convex scheduled functions for transitions

### Convex Schema (5 tables)

- `users` — streamer account, overlay tokens, bot account credentials, bot status
- `tasks` — viewer-submitted tasks with author info and status
- `timerState` — live timer state per user (server-authoritative timestamps)
- `config` — all settings in one document per user (timer, styles, messages, command aliases)
- `pomodoroHistory` — completed pomodoro session logs for analytics

### Command System

Commands use a flat `commandAliases` map in config: `{ "!pomo": "timer:start", "!task": "task:add" }`. O(1) lookup, no collision possible.

## Build & Development Commands

```bash
pnpm install                    # Install dependencies
pnpm dev                        # Start Next.js + Convex dev servers (via Turborepo)
pnpm dev:web                    # Start only Next.js dev server
pnpm dev:server                 # Start only Convex dev server
npx convex dev                  # Connect to self-hosted Convex, watch for changes
npx convex deploy               # Deploy functions to self-hosted Convex (production)
pnpm build                      # Production build
```

### Adding shadcn/ui components

```bash
cd apps/web && pnpm dlx shadcn@latest add <component-name>
```

## Self-Hosted Convex

Convex runs as a self-hosted instance on Coolify (not Convex Cloud). Development credentials go in `packages/backend/.env.local`:

```bash
CONVEX_SELF_HOSTED_URL='https://convex.yourdomain.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='<from docker compose exec backend ./generate_admin_key.sh>'
```

Next.js env vars go in `apps/web/.env`:

```bash
NEXT_PUBLIC_CONVEX_URL='https://convex.yourdomain.com'
NEXT_PUBLIC_CONVEX_SITE_URL='https://convex.yourdomain.com'
```

The CLI detects `CONVEX_SELF_HOSTED_URL` and routes all commands to your instance.

## Convex Environment Variables

Set on the self-hosted Convex instance via `npx convex env set KEY=VALUE`:
- `BETTER_AUTH_SECRET` — auth secret (generate with `openssl rand -base64 32`)
- `SITE_URL` — production URL of the Next.js app
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — Twitch OAuth credentials

## File Structure

- `apps/web/src/app/` — Next.js pages and API routes
  - `page.tsx` — Login page (Sign in with Twitch), auto-redirects if authenticated
  - `dashboard/` — Dashboard pages (one page per tab: general, timer, tasks, styles, messages, commands, overlays, analytics)
  - `overlay/t/[token]/` — Timer overlay with `use-timer-bot.ts` hook
  - `overlay/l/[token]/` — Task list overlay with `use-tasks-bot.ts` hook
  - `auth/twitch/bot/` — Bot account OAuth routes
- `apps/web/src/components/` — Shared components (header, user-menu, providers, mode-toggle, ui/)
- `apps/web/src/lib/` — Auth helpers, timer display hook, utils
- `apps/fumadocs/` — Fumadocs documentation site (self-hosting guide)
- `packages/backend/convex/` — Convex schema, mutations, queries, crons, auth
- `packages/env/` — t3-env environment validation
- `packages/config/` — Shared TypeScript config

## Implementation Phases

Follow the 11 phases in `PLAN.md` § "Implementation Phases":
1. Project Setup (scaffold + auth) **[in progress]**
2. Schema & Defaults
3. Bot OAuth Flow
4. Timer State Machine
5. Timer Overlay + Bot
6. Tasks CRUD + Overlay + Bot
7. Dashboard Config UI (with live overlay preview)
8. Analytics
9. Token Refresh Cron + Error Handling
10. Documentation Site
11. Polish

## Security Notes

- Overlay tokens grant access to bot credentials — URLs must stay private
- Bot OAuth tokens stored in Convex, refreshed by a cron job every 30 minutes
- Minimal Twitch scopes: `user:read:email` (login), `chat:read chat:edit` (bot)
- Task text sanitized on insert; React handles XSS escaping on display
- Overlays render nothing on error (transparent for OBS)
