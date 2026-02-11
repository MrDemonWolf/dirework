# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- Bot Account section from main dashboard (moved to Bot Settings)
- Old `messages` Json column (replaced by individual typed columns via migration)
