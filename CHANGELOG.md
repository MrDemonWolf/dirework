# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-07-10

### Changed
- **Rebuilt on Cloudflare Workers** — the entire stack moved from Node.js + PostgreSQL +
  Docker to Cloudflare Workers + D1 (SQLite) + Hono, deployable on the free plan
  - Two workers (`dirework` web via OpenNext, `dirework-api` Hono) + D1, managed by Alchemy
  - Twitch chat bot now runs in a token-gated browser page (`/bot/<token>`) holding the
    IRC WebSocket — add it as an OBS browser source or pinned tab; command logic runs
    server-side via `bot.ingest`
  - Overlays switched from Server-Sent Events to polling with local countdown
  - Auth and dashboard API calls proxy same-origin through the web worker (workers.dev
    cookie isolation); overlays and the bot page talk to the API worker directly
  - Mutation logic extracted into shared services used by both the dashboard API and chat
    commands; timer/task command drift bugs fixed along the way
  - Security hardening from the pre-migration audit: bot OAuth tokens no longer sent to
    the browser, constant-time token comparison, bounded public inputs, chat task length
    and per-user caps
  - CI deploys on push to `main` via GitHub Actions + Alchemy
- Removed Docker, Docker Compose, Coolify, and PostgreSQL deployment paths (see the new
  Cloudflare deployment guide)

### Added
- Single-owner architecture with a first-time setup flow — the first Twitch account to sign in claims the instance
- Redesigned documentation landing page with a "focus console" theme, three-step quick start, and ADHD-friendly copy
- Branded loading state (focus-ring spinner) and a warmer first-time setup screen
- Shared `DEFAULT_PHASE_LABELS` constant and Twitch brand color token to keep timer labels and buttons consistent
- Footer version readout (`v<version> · <commit>`) that polls the live deploy and
  prompts a **Reload** when a newer build has shipped — DireWork runs as a rolling
  build off `main`, so an open dashboard tab can outlive its own code

### Changed
- Rewrote Getting Started, Deployment, and reference docs to match the real stack (Bun + Drizzle on Cloudflare D1 + Alchemy/Cloudflare Workers), correcting stale pnpm/Prisma/nixpacks instructions
- Corrected the bot OAuth callback path in docs to `/api/bot/callback/twitch`
- Consolidated duplicated timer formatting and route session guards into shared helpers (`formatClock`, `requireSession`)

### Removed
- Dropped the never-implemented `ALLOWED_TWITCH_IDS` allowlist from docs and examples — single-owner login already restricts access

## [1.0.0] - 2026-02-12

### Added
- Pomodoro timer with configurable work/break/long break durations, automatic phase transitions, and cycle tracking
- Task list with Twitch chat integration — viewers add and manage tasks via chat commands
- OBS overlays (timer + task list) with transparent backgrounds and real-time SSE updates
- Timer overlay supports circle and rounded rectangle (squircle) progress ring shapes
- Task list overlay groups tasks by author with styled card containers and per-author done/total counts
- Scroll enabled/disabled toggle for task list overlay
- Twitch chat bot with configurable commands for tasks (!task, !done, !edit, !remove, !check, !next) and timer (!timer start/pause/resume/skip, !time, !eta)
- Bot account connection via separate OAuth flow with error feedback
- 18 customizable task bot response messages and 14 timer bot response messages
- Enable/disable toggles for task and timer command groups
- Command alias system for remapping bot commands
- Theme Center visual style editor with 11 presets (Default, Liquid Glass Light/Dark, Neon Cyberpunk, Cozy Cottage, Ocean Depths, Sakura, Retro Terminal, Minimal Light, Sunset, Twitch Purple)
- Timer preview animation toggle in Theme Center (play/pause live countdown simulation)
- Phase Labels editor for customizing timer overlay state labels (Focus, Break, Long Break, etc.)
- Dashboard with timer controls, task manager, overlay previews, and live timer status badge
- Task manager groups tasks by author with per-author pending/done counts
- Bot Settings page with two-column layout: sticky sidebar (bot account, toggles, aliases) + scrollable message editors
- Variable/placeholder reference panels in bot settings UI
- Overlay access via UUID tokens (no auth required), regenerable per user
- Server-Sent Events (SSE) for overlay real-time updates via tRPC subscriptions
- Tooltip component with glass styling on timer config labels
- Mobile hamburger navigation menu
- Skeleton loading states for dashboard, styles, and bot settings pages
- Sticky save/reset bars when unsaved changes exist
- Self-hosted single-user per instance with Twitch OAuth login
- CI/CD pipeline (GitHub Actions) with type-checking, build, and tests (Drizzle is schema-as-code, no codegen step)
- Vitest unit tests for config defaults, deep merge, config types, and theme presets
- Fumadocs documentation site with macOS 26 Liquid Glass purple theme
- Documentation covering getting started, features, deployment, chat commands, overlays, environment variables, Twitch OAuth, and troubleshooting
- Full SEO metadata (OpenGraph, Twitter cards, keywords) on documentation site
- Coolify deployment guide with Docker and PostgreSQL setup

### Architecture
- Turborepo + Bun workspaces monorepo with ESM throughout
- Next.js 16 (App Router) with React 19, React Compiler, and typed routes
- tRPC v11 with httpBatchLink, httpSubscriptionLink (SSE), and splitLink
- Better Auth with Twitch social provider (30-day sessions)
- Drizzle ORM with PostgreSQL 17 and 4 focused config models (timerConfig, timerStyle, taskStyle, botConfig)
- All config columns have Drizzle defaults — rows lazily provisioned on first access
- API maps flat DB columns to nested frontend objects via build/flatten helpers
- Overlays receive pre-built nested config objects from public API procedures
- In-process EventEmitter bus for SSE event routing
- Tailwind CSS v4 with shadcn/ui (base-lyra style) and Lucide icons
- Fumadocs documentation with Orama search, deployed to GitHub Pages
