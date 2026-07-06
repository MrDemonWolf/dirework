# Dirework - Pomodoro Timer and Task List for Twitch

Dirework is a personal project built for my own Twitch
co-working and body-doubling streams. It combines a
Pomodoro timer, viewer task list, and Twitch chat bot into
a single self-hosted tool with customizable OBS overlays.

It is open source and runs entirely on Cloudflare's free
plan. If you want the same setup for your own channel, fork
it and deploy your own instance — one streamer, one
instance, zero distractions.

## Features

- **Pomodoro Timer** - Configurable work/break cycles with
  a macOS-style progress ring, visible as an OBS overlay.
- **Task List** - Viewers add and manage tasks via chat
  commands, displayed as a scrolling OBS overlay.
- **Twitch Bot** - Dedicated bot account for chat commands
  like `!task`, `!done`, `!timer start`, and `!timer eta`. Customizable
  wolf-themed response messages, enable/disable toggles for task
  and timer command groups, and configurable phase labels. The
  bot runs in a token-gated browser page (OBS source or pinned
  tab) — no always-on server needed.
- **Theme Center** - 6 built-in themes including Liquid
  Glass Dark, Ocean Depths, Cozy Cottage, and Twitch Purple
  with full style customization for colors, fonts, and layout.
- **Live Preview** - See overlay changes on the dashboard
  before going live.
- **Dashboard** - Control the timer, manage tasks, and preview
  overlays from one page.
- **Bot Settings** - Bot account management, message
  customization, command aliases, and the bot console link.
- **Serverless** - Two Cloudflare Workers plus a D1 database.
  Free plan, no servers, no Docker, single user per instance.

## Getting Started

For full setup instructions including Twitch OAuth, bot
account configuration, and OBS setup, see the
**[Documentation](https://mrdemonwolf.github.io/dirework)**.

1. Clone the repository
2. Install dependencies with `bun install`
3. Copy `.env.example` to `packages/infra/.env` and fill in
   `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and a generated
   `BETTER_AUTH_SECRET`
4. Start everything with `bun run dev` (API worker on port 3000,
   web on port 3001, local D1 database included)
5. Open `http://localhost:3001` — on first run you'll be
   redirected to `/setup` to claim the instance with your Twitch
   account

## Usage

### Viewer Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `!task <text>`          | Add a new task                             |
| `!done [number]`        | Mark your active (or a numbered) task done |
| `!edit <number> <text>` | Edit the numbered task                     |
| `!remove <number>`      | Remove the numbered task                   |
| `!focus <number>`       | Make the numbered task your active task    |
| `!check [@user]`        | Show your (or another user's) active task  |
| `!next <text>`          | Complete active task and start a new one   |
| `!help`                 | Show the command help message              |

### Mod Commands

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `!clear all`     | Clear all tasks                       |
| `!clear done`    | Clear completed tasks                 |
| `!clear @user`   | Remove all tasks from a specific user |

### Timer Commands (mods only)

| Command                 | Description                                 |
| ----------------------- | ------------------------------------------- |
| `!timer start [cycles]` | Start the timer (optional cycle count 1-99) |
| `!timer pause`          | Pause the timer                             |
| `!timer resume`         | Resume the timer                            |
| `!timer skip`           | Skip the current phase                      |
| `!timer reset`          | Reset the timer                             |
| `!timer eta`            | Show when the timer ends                    |

See the [full command reference](https://mrdemonwolf.github.io/dirework/docs/chat-commands)
for all options and customizable bot responses. Viewers can also run `!dwhelp` or
`!dwcommands` in chat at any time to get the command list.

### Bot Configuration

Navigate to `/dashboard/bot` to manage your bot account,
customize all response messages (wolf-themed defaults included),
enable or disable task and timer command groups, set up command
aliases, and copy your bot console link. The bot listens to chat
while the bot console page is open — add it to OBS as a browser
source or keep the tab pinned.

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5     |
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
- `bun run dev:web` - Start the web app only
- `bun run dev:server` - Start the API worker only
- `bun run build` - Build all apps for production
- `bun run check-types` - Run TypeScript type checking
- `bun run test` - Run unit tests across all packages
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
- **Drizzle ORM** for type-safe database access
- **tRPC** for end-to-end type-safe API layer
- **t3-env** for environment variable validation
- **Turborepo** for monorepo build orchestration
- **GitHub Actions** CI runs type checks, builds, and tests on every push

## Deployment

Dirework deploys to Cloudflare Workers via GitHub Actions:
set five repository secrets, push to `main`, done. Both
workers, the D1 database, and its migrations are managed by
[Alchemy](https://alchemy.run).

See the **[Deployment guide](https://mrdemonwolf.github.io/dirework/docs/deployment)**
for the step-by-step walkthrough (Cloudflare API token, Twitch
redirect URLs, GitHub secrets, and the post-deploy checklist).

## Project Structure

```
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
│   └── config/        # Shared TypeScript configuration
```

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/dirework.svg?style=for-the-badge&logo=github)](https://github.com/MrDemonWolf/dirework/blob/main/LICENSE)

## Contact

If you have any questions, suggestions, or feedback:

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
