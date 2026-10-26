# DireWork - Pomodoro Timer and Task List for Twitch

DireWork is a personal project built for my own Twitch
co-working and body-doubling streams. It combines a
Pomodoro timer, viewer task list, and Twitch chat bot into
a single self-hosted tool with customizable OBS overlays.

It is open source and supports Cloudflare's free plan for the core app,
within the account's usage limits. Free-tier support is a project commitment;
no paid Cloudflare service is required. Fork it and deploy your own instance:
one streamer, one owner, one channel.

DireWork is always self-hosted. MrDemonWolf, Inc. does not offer hosted instances
or a managed hosting service.

## Features

- **Pomodoro Timer** - Configurable work/break cycles with
  a macOS-style progress ring, visible as an OBS overlay.
- **Task List** - Viewers add and manage tasks via chat
  commands, displayed as a scrolling OBS overlay.
- **Twitch Bot** - Dedicated bot account for chat commands
  like `!task`, `!done`, `!timer start`, and `!timer eta`. Reply
  templates are editable (a few usage hints are fixed), and the task
  and timer command groups can be turned off. The bot runs in a token-gated browser page (an
  invisible widget in OBS or Moblin, or a dock in OBS or a pinned tab), so no always-on
  server is needed.
- **Theme Center** - 6 built-in themes, including Liquid
  Glass Dark, Ocean Depths, Cozy Cottage, and Twitch Purple,
  plus editable colors, fonts, layout, and phase labels.
- **Live Preview** - See overlay changes on the dashboard
  before going live.
- **Dashboard** - Control the timer, manage tasks, and preview
  overlays from one page.
- **Bot Settings** - Bot account management, message
  customization, command aliases, and the bot console link.
- **Serverless** - Two Cloudflare Workers plus a D1 database.
  Free-tier compatible, no servers, no Docker, single owner per instance.

## Getting Started

For full setup instructions including Twitch OAuth, bot
account configuration, and OBS setup, see the
**[Documentation](https://dirework.mrdemonwolf.dev)**.

**[Deploy on Cloudflare](https://dirework.mrdemonwolf.dev/docs/deployment#quick-start)**
opens the guided setup. The core app supports the free tier; no paid service or
local development setup is required. Initial setup needs your Twitch keys and
GitHub secrets; the link does not provision resources with one click.

1. Follow the short setup checklist, run **Actions → Deploy → Run workflow** in
   your fork, then claim the instance immediately with your streamer account.
2. Connect your bot account in Dashboard → Bot.
3. Keep one bot page open (the invisible widget in OBS or Moblin, or the dock in OBS or a browser tab); chat commands require it.
4. Add the timer and task overlays to OBS and try a task command and timer cycle.

To try it locally first, follow [Development](#development).

## Usage

### Viewer Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `!task <text>`          | Add a new task                             |
| `!done [number]`        | Mark your active (or a numbered) task done |
| `!edit <number> <text>` | Edit the numbered task                     |
| `!remove <number>`      | Remove the numbered task                   |
| `!focus <number>`       | Make the numbered task your active task    |
| `!start <number>`       | Start a task beside your focus (3 at once) |
| `!pause [number]`       | Pause your focus (or a numbered task)      |
| `!check [@user]`        | Show your (or another user's) active task  |
| `!today`                | Show your focus and next numbered tasks    |
| `!next <text>`          | Complete active task and start a new one   |
| `!help`                 | Show the command help message              |

### Mod Commands

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `!clear all`     | Clear all tasks                                   |
| `!clear done`    | Clear completed tasks                             |
| `!clear @user`   | Remove all tasks from a specific user             |
| `!mute`          | Pause the bot: ignore every command, post nothing |
| `!unmute`        | Resume the bot                                    |
| `!block @user`   | Ignore a viewer's commands and remove their tasks |
| `!unblock @user` | Let a blocked viewer use commands again           |

### Timer Commands (mods only)

| Command                 | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `!timer start [cycles]` | Start the timer (optional cycle count 1-99)               |
| `!timer pause`          | Pause the timer                                           |
| `!timer resume`         | Resume the timer                                          |
| `!timer skip`           | Skip the current phase                                    |
| `!timer reset`          | Reset the timer                                           |
| `!timer eta`            | Show time left in the current phase and the whole session |

See the [full command reference](https://dirework.mrdemonwolf.dev/docs/chat-commands)
for all options and customizable bot responses. Viewers can run `!dw help` in chat at any
time for a 3-step starter guide, `!dw help task` (or any command) for a plain-language
explanation, and `!dwhelp` or `!dwcommands` for the full command list.

### Bot Configuration

Go to `/dashboard/bot` to manage your bot account, edit the
response messages, enable or disable the task and timer command
groups, set up command aliases, and copy your bot page link.
The bot listens to chat while its page is open. Pick how you run it: the **widget** is
blank and transparent, so it can sit on any OBS or Moblin scene; the **dock** shows status
and controls in an OBS custom browser dock or a pinned tab. Keep to one
copy: a second one is harmless (DireWork runs each chat
message once, by its Twitch message id), but it doubles the
Worker requests every command costs.

Treat the bot console and overlay URLs as bearer credentials: anyone with a copied
link can use it until you regenerate the corresponding token.

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 7     |
| Styling   | Tailwind CSS v4, shadcn/ui                          |
| API       | Hono + tRPC v11, TanStack React Query               |
| Auth      | Better Auth (Twitch OAuth)                          |
| Database  | Cloudflare D1 (SQLite) + Drizzle ORM                |
| Chat Bot  | IRC-over-WebSocket in a token-gated browser page    |
| Runtime   | Cloudflare Workers (web via OpenNext)               |
| Deploy    | Alchemy (infrastructure-as-code) + GitHub Actions   |
| Docs      | Fumadocs                                            |
| Monorepo  | Turborepo + Bun workspaces                          |

## Development

### Prerequisites

- Node.js 22+
- Bun 1.3+
- A Twitch Developer Application
  ([dev.twitch.tv](https://dev.twitch.tv/console))

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/mrdemonwolf/dirework.git
   cd dirework
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Create your environment file:

   ```bash
   cp .env.example packages/infra/.env
   ```

   Fill in `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps),
   and generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.
   Add `http://localhost:3001/api/auth/callback/twitch` and
   `http://localhost:3001/api/bot/callback/twitch` as redirect URLs
   on your Twitch app.

4. Start everything:

   ```bash
   bun run dev
   ```

   Alchemy runs the API worker (port 3000), the web app
   (port 3001), and a local D1 database with migrations applied.

### Development Scripts

- `bun run dev` - Start all apps with a local D1 database
- `bun run dev:web` - Start only the web app (standalone Next dev on port 3001; the API comes from `bun run dev` or a deployed origin)
- `bun run build` - Build all apps for production
- `bun run lint` - Lint and format-check with Biome
- `bun run audit:dependencies` - Fail on unmitigated high-severity dependency advisories
- `bun run lint:fix` - Apply Biome's safe lint fixes and formatting
- `bun run format` - Format the whole repo with Biome
- `bun run tokens` - Regenerate the design-system outputs from `design-system/tokens.json`
- `bun run check-types` - Run TypeScript type checking
- `bun run test` - Run unit tests across all packages
- `bun run test:coverage` - Run tests with coverage thresholds enforced
- `bun run recovery:check` - Check a synthetic local database export/import; does not access production
- `bun run clean` - Remove generated build and type artifacts
- `bun run db:generate` - Generate a new Drizzle migration from schema changes
- `bun run deploy` - Deploy both workers and the database to Cloudflare
- `bun run destroy` - Tear down the Cloudflare deployment

### Testing

- **Vitest** for unit testing across all packages
- Tests cover the timer state machine, task/timer services,
  config build/flatten helpers, round-trip consistency, display
  utilities, task grouping, and token verification
- Run with `bun run test`

### Code Quality

- **TypeScript** in strict mode across all packages
- **Biome** for linting and formatting, enforced in CI
- **Drizzle ORM** for type-safe database access
- **tRPC** for end-to-end type-safe API layer
- **t3-env** for environment variable validation
- **Turborepo** for monorepo build orchestration
- **GitHub Actions** runs one shared verification pipeline (dependency audit, lint, type check, tests with
  coverage thresholds, production build) on every push, and again before any deploy.
  CodeQL adds extended static security analysis on pushes, pull requests, and weekly.
  Actions are SHA-pinned and kept current by Dependabot.

## Deployment

DireWork deploys to Cloudflare Workers via GitHub Actions:
set seven repository secrets and two variables, push to `main`. Both
workers, the D1 database, and its migrations are managed by
[Alchemy](https://alchemy.run).

> **Sign in immediately after the first deploy.** Until someone signs
> in, the instance is unclaimed and the first Twitch account to sign
> in (anyone's) becomes its owner. Don't share the URL before you've
> claimed it. If someone else claimed it, follow
> [Recovering an instance someone else claimed](https://dirework.mrdemonwolf.dev/docs/deployment#recovering-an-instance-someone-else-claimed).

See the **[Deployment guide](https://dirework.mrdemonwolf.dev/docs/deployment)**
for the step-by-step walkthrough (Cloudflare API token, Twitch
redirect URLs, GitHub secrets, and the post-deploy checklist).
On a fork, enable Actions first (GitHub turns workflows off on
new forks), then run **Actions → Deploy → Run workflow**. To
pick up new releases later, follow
[Updating your instance](https://dirework.mrdemonwolf.dev/docs/deployment#updating-your-instance).

Before relying on an instance for a stream, complete the guide's post-deploy
checklist, monitoring, and recovery checks. Free-tier quotas are shared across
your Cloudflare account; leaving OBS sources open continues to use requests.
See [Free plan limits](https://dirework.mrdemonwolf.dev/docs/deployment#free-plan-limits).

For repository documentation, start with the [documentation map](docs/README.md).
It separates current guides and architecture decisions from dated historical reviews.

## Project Structure

```text
dirework/
├── apps/
│   ├── web/           # Next.js app on Workers (dashboard, overlays, bot page), port 3001
│   ├── server/        # Hono API worker (auth, tRPC, bot OAuth), port 3000
│   └── fumadocs/      # Documentation site, port 4000
├── packages/
│   ├── api/           # tRPC routers, services, bot command logic
│   ├── auth/          # Better Auth configuration
│   ├── db/            # Drizzle schema + D1 client + migrations
│   ├── env/           # Environment bindings + validation
│   ├── infra/         # Alchemy infrastructure (workers + D1)
│   ├── fonts/         # Self-hosted UI fonts shared by app and docs
│   ├── overlay-kit/   # Shared overlay geometry + clock formatting (web + docs)
│   ├── e2e/           # Local Worker browser tests and synthetic recovery drill
│   └── config/        # Shared TypeScript configuration
```

## Security

Report vulnerabilities privately and follow the production operator checklist in
[SECURITY.md](SECURITY.md). Never include credentials, bearer URLs, personal data, or
exploit details in a public issue.

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/dirework.svg?style=for-the-badge&logo=github)](https://github.com/MrDemonWolf/dirework/blob/main/LICENSE)

## Contact

If you have any questions, suggestions, or feedback:

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
