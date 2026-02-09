# Dirework - Pomodoro Timer & Task List for Twitch

Self-hosted Pomodoro timer and task list with Twitch chat integration.
Designed for co-working and body-doubling streams. Streamers login with
Twitch, connect a bot account, configure OBS overlays, and their viewers
can interact via chat commands.

Focus together, stay productive, and build community — one pomodoro at
a time.

## Features

- **Pomodoro Timer**: Configurable work/break durations with cycle
  tracking, visible as an OBS overlay.
- **Task List**: Viewers add and manage tasks via chat commands,
  displayed as a scrolling OBS overlay.
- **Twitch Bot Integration**: Chat commands for tasks (`!task`,
  `!done`) and timer (`!timer start`, `!time`).
- **OBS Browser Source Overlays**: Transparent overlays for timer and
  task list, fully customizable styling.
- **Dashboard**: Control timer, manage tasks, preview overlays, and
  configure settings from one page.
- **Self-Hosted**: Single-user per instance, deploy on your own server.

## Getting Started

For full setup instructions including Twitch OAuth configuration,
environment variables, and deployment, see the
**[Documentation](https://dirework.example.com/docs)**.

1. Clone the repository
2. Install dependencies with `pnpm install`
3. Configure your `.env` file (see docs)
4. Start PostgreSQL with `pnpm db:start`
5. Push the database schema with `pnpm db:push`
6. Start the dev server with `pnpm dev`

## Usage

### Chat Commands (Viewers)

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `!task <text>`       | Add a new task                        |
| `!done`              | Mark your oldest pending task as done |
| `!edit <text>`       | Edit your oldest pending task         |
| `!remove`            | Remove your oldest pending task       |
| `!check`             | Show your current tasks               |

### Chat Commands (Mods)

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `!clear`             | Clear all tasks                       |
| `!cleardone`         | Clear completed tasks                 |
| `!adel @user`        | Remove all tasks from a user          |

### Timer Commands

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `!timer start`       | Start the timer                       |
| `!timer <minutes>`   | Start with specific duration          |
| `!timer pause/resume`| Pause or resume the timer             |
| `!time`              | Show remaining time                   |

## Tech Stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Frontend      | Next.js (App Router), React, Tailwind, shadcn/ui |
| Backend       | Next.js API routes + tRPC                        |
| Auth          | Better Auth (Twitch social provider)             |
| Database      | PostgreSQL (Docker) + Prisma ORM                 |
| Chat Bot      | @twurple (runs inside overlay browser sources)   |
| Documentation | Fumadocs                                         |
| Monorepo      | Turborepo + pnpm workspaces                      |

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for PostgreSQL)
- A Twitch Developer Application

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

3. Copy and configure environment variables:

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

4. Start the database:

   ```bash
   pnpm db:start
   ```

5. Push the schema and start dev:

   ```bash
   pnpm db:push
   pnpm dev
   ```

### Development Scripts

- `pnpm dev` - Start all apps (web + docs)
- `pnpm build` - Build all apps for production
- `pnpm check-types` - Run TypeScript type checking
- `pnpm db:start` - Start PostgreSQL (Docker)
- `pnpm db:stop` - Stop PostgreSQL
- `pnpm db:push` - Push Prisma schema to database
- `pnpm db:studio` - Open Prisma Studio
- `pnpm db:generate` - Regenerate Prisma client

### Code Quality

This project uses:

- **TypeScript** for type safety
- **Prisma** for database management
- **tRPC** for type-safe API layer
- **t3-env** for environment variable validation
- **Turborepo** for monorepo build orchestration

## Project Structure

```
dirework/
├── apps/
│   ├── web/           # Next.js app (frontend + API)
│   └── fumadocs/      # Documentation site
├── packages/
│   ├── api/           # tRPC routers + business logic
│   ├── auth/          # Better Auth configuration
│   ├── db/            # Prisma schema + client
│   └── env/           # Environment variable validation
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/dirework.svg?style=for-the-badge&logo=github)

## Contact

If you have any questions, suggestions, or feedback:

- Discord: [Join my server](https://mrdwolf.com/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
