# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
- CI/CD pipeline (GitHub Actions) with Prisma generation, type-checking, and tests
- Vitest unit tests for config defaults, deep merge, config types, and theme presets
- Fumadocs documentation site with macOS 26 Liquid Glass purple theme
- Documentation covering getting started, features, deployment, chat commands, overlays, environment variables, Twitch OAuth, and troubleshooting
- Full SEO metadata (OpenGraph, Twitter cards, keywords) on documentation site
- Coolify deployment guide with Docker and PostgreSQL setup

### Architecture
- Turborepo + pnpm workspaces monorepo with ESM throughout
- Next.js 16 (App Router) with React 19, React Compiler, and typed routes
- tRPC v11 with httpBatchLink, httpSubscriptionLink (SSE), and splitLink
- Better Auth with Twitch social provider (30-day sessions)
- Prisma 7 with PostgreSQL 17 and 4 focused config models (TimerConfig, TimerStyle, TaskStyle, BotConfig)
- All config columns have Prisma defaults — rows lazily provisioned on first access
- API maps flat DB columns to nested frontend objects via build/flatten helpers
- Overlays receive pre-built nested config objects from public API procedures
- In-process EventEmitter bus for SSE event routing
- Tailwind CSS v4 with shadcn/ui (base-lyra style) and Lucide icons
- Fumadocs documentation with Orama search, deployed to GitHub Pages
