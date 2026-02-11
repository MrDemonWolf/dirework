# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Task list groups tasks by author with styled card containers and per-author done/total counts (overlay + dashboard)
- Scroll enabled/disabled toggle for task list overlay (new `scrollEnabled` field in TaskStyle)
- Timer preview animation toggle in Theme Center (play/pause live countdown simulation)
- Missing task style editor controls: bullet section, checkbox background/border details, body padding, header padding, task max width
- Server-Sent Events (SSE) for overlay real-time updates replacing polling (via tRPC subscriptions + in-process EventEmitter)
- Tooltip component (`@base-ui/react/tooltip`) with glass styling matching dropdown menus
- Info tooltips on all 5 timer config labels (work, break, long break, every, pomos)
- Phase Labels editor in Theme Center Timer tab (moved from Bot Settings)
- Comprehensive Coolify deployment guide in deployment docs
- Landing page with hero section, gradient branding, and features showcase
- Timer status badge on dashboard showing live timer state
- Skeleton loading states for dashboard, styles, and bot settings pages
- Mobile hamburger navigation menu
- Cycle progress dots on timer display
- Collapsible timer settings panel
- Bot Settings page (`/dashboard/bot`) with dedicated bot account management
- Wolf-themed default bot messages for all task and timer commands
- Enable/disable toggles for task and timer command groups
- Customizable phase labels (Focus, Break, Long Break, etc.) for timer display
- Variable/placeholder reference panels in bot settings UI
- Message variables documentation in chat commands docs
- 18 task message fields and 14 timer message fields (up from 8 total)
- 7 configurable phase labels for timer overlay states
- Individual typed database columns for all messages, toggles, and labels
- CI/CD pipeline (GitHub Actions) with type-checking and tests on PRs to main and pushes to dev
- Vitest unit tests for config defaults, deep merge, config types, and theme presets
- CHANGELOG.md

### Changed
- Database restructured from single Config model (55+ columns + 4 JSON blobs) into 4 focused models: TimerConfig, TimerStyle, TaskStyle, BotConfig — all fields are typed Prisma columns with defaults
- API config router rewritten with typed Zod schemas, build/flatten helpers for nested ↔ flat conversion, and lazy-provisioning via `ensureUserConfig()`
- Theme Center styles page width changed from `max-w-6xl` to `max-w-5xl` to match dashboard
- Overlays use SSE subscriptions instead of polling for instant updates
- Overlays receive pre-built nested config objects from API — removed client-side deep-merge dependency
- Bot Settings page redesigned with two-column layout: sticky sidebar (bot account, toggles, aliases) + scrollable message editors
- Dropdown menu hover effect now fills full width (fixed `mx-1` inset issue)
- Dashboard layout: timer is now the hero card, tasks and overlay URLs in two-column grid
- Timer display enlarged from 6xl to 7xl/8xl font
- Task list items redesigned with checkbox-style completion and hover interactions
- Active nav items use branded primary color instead of generic accent
- Overlay URLs redesigned with icons and styled containers
- Save bars on styles and bot settings pages are now sticky/fixed when unsaved changes exist
- Moved Bot Account card from dashboard to dedicated Bot Settings page
- Bot OAuth callback now redirects to `/dashboard/bot`
- Restructured messages storage from single Json column to individual typed database columns
- Timer overlay now reads phase labels from dedicated database columns

### Removed
- Old monolithic Config model (replaced by TimerConfig, TimerStyle, TaskStyle, BotConfig)
- `deep-merge.ts` utility (no longer needed — API returns pre-built nested objects)
- `task.direction` field from task styles (was hardcoded to "row", never used)
- `extractTaskMessages`, `extractTimerMessages`, `extractPhaseLabels` functions (logic moved to API build helpers)
- Phase Labels from Bot Settings page (moved to Theme Center Timer tab)
- Bot Account section from main dashboard (moved to Bot Settings)
- Old `messages` Json column (replaced by individual typed columns via migration)
