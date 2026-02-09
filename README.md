# Dirework

Self-hosted Pomodoro timer and task list with Twitch chat integration. Streamers login with Twitch, connect a bot account, configure overlays, and add them to OBS. Viewers interact via `!task`, `!done`, `!timer`, and more.

## Quick Start

For full setup instructions including Twitch OAuth configuration, environment variables, and deployment, see the **[Documentation](http://localhost:4000/docs)**.

```bash
pnpm install
pnpm db:start        # Start PostgreSQL (Docker)
pnpm db:push         # Push schema to database
pnpm dev             # Start all apps
```

- Web app: [http://localhost:3001](http://localhost:3001)
- Documentation: [http://localhost:4000](http://localhost:4000)

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

MIT
