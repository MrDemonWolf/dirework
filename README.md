# Dirework - Pomodoro Timer and Task List for Twitch

Self-hosted Pomodoro timer and task list built for Twitch
co-working and body-doubling streams. Your viewers join the
grind through chat commands while customizable OBS overlays
keep everyone focused and in sync.

One streamer, one instance, zero distractions.

## Features

- **Pomodoro Timer** - Configurable work/break cycles with
  a macOS-style progress ring, visible as an OBS overlay.
- **Task List** - Viewers add and manage tasks via chat
  commands, displayed as a scrolling OBS overlay.
- **Twitch Bot** - Dedicated bot account for chat commands
  like `!task`, `!done`, `!timer start`, and `!time`.
- **Theme Center** - 11 built-in themes including Liquid
  Glass, Neon Cyberpunk, Sakura, and Retro Terminal with
  full style customization for colors, fonts, and layout.
- **Live Preview** - See overlay changes in real-time on the
  dashboard before going live.
- **Dashboard** - Control the timer, manage tasks, preview
  overlays, and connect your bot from one page.
- **Self-Hosted** - Own your data, deploy anywhere, single
  user per instance.

## Getting Started

For full setup instructions including Twitch OAuth, bot
account configuration, and OBS setup, see the
**[Documentation](https://dirework-docs.vercel.app/docs)**.

1. Clone the repository
2. Install dependencies with `pnpm install`
3. Start PostgreSQL with `pnpm db:start`
4. Push the database schema with `pnpm db:push`
5. Configure your `apps/web/.env` file
6. Start the dev server with `pnpm dev`
7. Open `http://localhost:3001` and sign in with Twitch

## Usage

### Viewer Commands

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `!task <text>`   | Add a new task                        |
| `!done`          | Mark your oldest pending task as done |
| `!edit <text>`   | Edit your oldest pending task         |
| `!remove`        | Remove your oldest pending task       |
| `!check`         | Show your current tasks               |

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
| `!time`               | Show remaining time            |

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5    |
| Styling   | Tailwind CSS v4, shadcn/ui, Montserrat + Roboto    |
| API       | tRPC v11, TanStack React Query                     |
| Auth      | Better Auth (Twitch OAuth)                         |
| Database  | PostgreSQL 16 + Prisma 7                           |
| Chat Bot  | Twurple (runs inside overlay browser sources)      |
| Docs      | Fumadocs                                           |
| Monorepo  | Turborepo + pnpm workspaces                        |

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+
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
   pnpm install
   ```

3. Start the database:

   ```bash
   pnpm db:start
   ```

4. Push the schema:

   ```bash
   pnpm db:push
   ```

5. Configure environment variables in `apps/web/.env`:

   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/dirework"
   BETTER_AUTH_SECRET="generate-a-random-32-character-string"
   BETTER_AUTH_URL="http://localhost:3001"
   CORS_ORIGIN="http://localhost:3001"
   TWITCH_CLIENT_ID="your_client_id"
   TWITCH_CLIENT_SECRET="your_client_secret"
   ```

6. Start the dev server:

   ```bash
   pnpm dev
   ```

### Development Scripts

- `pnpm dev` - Start all apps (web on port 3001, docs on port 4000)
- `pnpm build` - Build all apps for production
- `pnpm check-types` - Run TypeScript type checking
- `pnpm dev:web` - Start the web app only
- `pnpm db:start` - Start PostgreSQL via Docker
- `pnpm db:stop` - Stop PostgreSQL
- `pnpm db:push` - Push Prisma schema to database
- `pnpm db:generate` - Regenerate Prisma client
- `pnpm db:migrate` - Run Prisma migrations
- `pnpm db:studio` - Open Prisma Studio

### Code Quality

- **TypeScript** in strict mode across all packages
- **Prisma** for type-safe database access
- **tRPC** for end-to-end type-safe API layer
- **t3-env** for environment variable validation
- **Turborepo** for monorepo build orchestration

## Project Structure

```
dirework/
├── apps/
│   ├── web/           # Next.js app (frontend + API), port 3001
│   └── fumadocs/      # Documentation site, port 4000
├── packages/
│   ├── api/           # tRPC routers + business logic
│   ├── auth/          # Better Auth configuration
│   ├── db/            # Prisma schema + client
│   ├── env/           # Environment variable validation
│   └── config/        # Shared TypeScript configuration
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/dirework.svg?style=for-the-badge&logo=github)

## Contact

If you have any questions, suggestions, or feedback:

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
