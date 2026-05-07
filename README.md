# Dirework - Pomodoro Timer and Task List for Twitch

Dirework is a personal project built for my own Twitch
co-working and body-doubling streams. It combines a
Pomodoro timer, viewer task list, and Twitch chat bot into
a single self-hosted tool with customizable OBS overlays.

It is open source. If you want the same setup for your own
channel, fork it and run your own instance — one streamer,
one instance, zero distractions.

## Features

- **Pomodoro Timer** - Configurable work/break cycles with
  a macOS-style progress ring, visible as an OBS overlay.
- **Task List** - Viewers add and manage tasks via chat
  commands, displayed as a scrolling OBS overlay.
- **Twitch Bot** - Dedicated bot account for chat commands
  like `!task`, `!done`, `!timer start`, and `!time`. Customizable
  wolf-themed response messages, enable/disable toggles for task
  and timer command groups, and configurable phase labels.
- **Theme Center** - 11 built-in themes including Liquid
  Glass, Neon Cyberpunk, Sakura, and Retro Terminal with
  full style customization for colors, fonts, and layout.
- **Live Preview** - See overlay changes in real-time on the
  dashboard before going live.
- **Dashboard** - Control the timer, manage tasks, and preview
  overlays from one page.
- **Bot Settings** - Two-column layout for bot account management,
  message customization, and command aliases.
- **Self-Hosted** - Own your data, deploy anywhere, single
  user per instance.

## Getting Started

For full setup instructions including Twitch OAuth, bot
account configuration, and OBS setup, see the
**[Documentation](https://mrdemonwolf.github.io/dirework)**.

1. Clone the repository
2. Install dependencies with `bun install`
3. Configure your `apps/web/.env` file
4. Start PostgreSQL with `bun run db:start`
5. Push the database schema with `bun run db:push`
6. Start the dev server with `bun run dev:web`
7. Open `http://localhost:3001` — on first run you'll be redirected to `/setup` to claim the instance with your Twitch account

## Usage

### Viewer Commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `!task <text>`         | Add a new task                           |
| `!done [number]`       | Mark your oldest (or specific) task done |
| `!edit [number] <text>`| Edit your oldest (or specific) task      |
| `!remove [number]`     | Remove your oldest (or specific) task    |
| `!next <text>`         | Complete current task and start a new one|
| `!check [@user]`       | Show your (or another user's) tasks      |

### Mod Commands

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `!clear`         | Clear all tasks                       |
| `!cleardone`     | Clear completed tasks                 |
| `!adel @user`    | Remove all tasks from a user          |

### Timer Commands

| Command               | Description                    |
| --------------------- | ------------------------------ |
| `!timer start`        | Start the timer                |
| `!timer <minutes>`    | Start with specific duration   |
| `!timer pause/resume` | Pause or resume the timer      |
| `!timer skip`         | Skip the current phase         |
| `!timer goal <num>`   | Set pomodoro cycle count       |
| `!time`               | Show remaining time            |
| `!eta`                | Show when the timer ends       |

See the [full command reference](https://mrdemonwolf.github.io/dirework/docs/chat-commands)
for all options and customizable bot responses.

### Bot Configuration

Navigate to `/dashboard/bot` to manage your bot account,
customize all response messages (wolf-themed defaults included),
enable or disable task and timer command groups, and set up
command aliases.

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5    |
| Styling   | Tailwind CSS v4, shadcn/ui, Montserrat + Roboto    |
| API       | tRPC v11, TanStack React Query                     |
| Auth      | Better Auth (Twitch OAuth)                         |
| Database  | PostgreSQL 17 + Drizzle ORM                        |
| Chat Bot  | Twurple (runs inside overlay browser sources)      |
| Docs      | Fumadocs                                           |
| Monorepo  | Turborepo + Bun workspaces                         |

## Development

### Prerequisites

- Node.js 20+
- Bun 1.0+
- Docker (for PostgreSQL)
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

3. Configure environment variables in `apps/web/.env`:

   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/dirework"
   BETTER_AUTH_SECRET="generate-a-random-32-character-string"
   BETTER_AUTH_URL="http://localhost:3001"
   CORS_ORIGIN="http://localhost:3001"
   TWITCH_CLIENT_ID="your_client_id"
   TWITCH_CLIENT_SECRET="your_client_secret"
   ```

4. Start the database:

   ```bash
   bun db:start
   ```

5. Push the schema:

   ```bash
   bun db:push
   ```

6. Start the dev server:

   ```bash
   bun dev
   ```

### Development Scripts

- `bun dev` - Start all apps (web on port 3001, docs on port 4000)
- `bun build` - Build all apps for production
- `bun check-types` - Run TypeScript type checking
- `bun test` - Run unit tests across all packages
- `bun dev:web` - Start the web app only
- `bun db:start` - Start PostgreSQL via Docker
- `bun db:stop` - Stop PostgreSQL
- `bun run db:push` - Push Drizzle schema to database (dev only, no migration file)
- `bun run db:generate` - Generate a new Drizzle migration from schema changes
- `bun run db:migrate` - Apply pending Drizzle migrations
- `bun run db:studio` - Open Drizzle Studio

### Testing

- **Vitest** for unit testing across all packages
- Tests cover timer state machine, config build/flatten helpers,
  round-trip consistency, display utilities, task grouping, and
  event emitter isolation
- Run with `bun test`

### Code Quality

- **TypeScript** in strict mode across all packages
- **Drizzle ORM** for type-safe database access
- **tRPC** for end-to-end type-safe API layer
- **t3-env** for environment variable validation
- **Turborepo** for monorepo build orchestration
- **GitHub Actions** CI runs type checks, builds, and tests on every push

## Project Structure

```
dirework/
├── apps/
│   ├── web/           # Next.js app (frontend + API), port 3001
│   └── fumadocs/      # Documentation site, port 4000
├── packages/
│   ├── api/           # tRPC routers + business logic
│   ├── auth/          # Better Auth configuration
│   ├── db/            # Drizzle schema + client
│   ├── env/           # Environment variable validation
│   └── config/        # Shared TypeScript configuration
```

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/dirework.svg?style=for-the-badge&logo=github)](https://github.com/MrDemonWolf/dirework/blob/main/LICENSE)

## Contact

If you have any questions, suggestions, or feedback:

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
