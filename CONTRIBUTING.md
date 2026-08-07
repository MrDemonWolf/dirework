# Contributing to DireWork

Thank you for your interest in contributing to DireWork. This guide covers the setup and workflow for contributing.

## Prerequisites

- [Bun](https://bun.sh/) v1.3+
- [Node.js](https://nodejs.org/) v22+
- A [Twitch Developer Application](https://dev.twitch.tv/console/apps) for OAuth credentials

## Setup

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/<your-username>/dirework.git
   cd dirework
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Configure environment variables**:

   ```bash
   cp .env.example packages/infra/.env
   ```

   The file must live at `packages/infra/.env` — Alchemy loads it (and also
   `apps/web/.env` / `apps/server/.env` if present); a repo-root `.env` is never
   read. Fill in the required values — see `.env.example` for descriptions.

4. **Start the dev server**:

   ```bash
   bun run dev
   ```

   This runs Alchemy dev, which provisions a local D1 database and applies
   migrations automatically — no Docker or PostgreSQL required. The web app runs
   at `http://localhost:3001` and docs at `http://localhost:4000`.

   > If you change the Drizzle schema, run `bun run db:generate` to produce a new
   > migration; Alchemy applies it on the next `bun run dev`.

## Branch Workflow

- `main` — production branch, protected
- `dev` — development branch

All work should be done on feature branches created from `dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name
```

## Making Changes

- Follow existing code patterns and conventions documented in `AGENTS.md`
- Use TypeScript strict mode — no `any` types
- Use functional components with `"use client"` where needed
- Style with Tailwind utility classes
- Extract pure logic into testable modules (not inline in components/routers)

## Testing

Run the dependency audit and lint gate:

```bash
bun run audit:dependencies
bun run lint
```

Run the full test suite before submitting:

```bash
bun run test
```

Run type checking:

```bash
bun run check-types
```

Run a production build to catch build-time errors:

```bash
bun run build
```

When adding new pure functions, add corresponding tests in a `__tests__/` directory alongside the source file.

## Pull Request Process

1. Ensure `bun run audit:dependencies`, `bun run lint`, `bun run check-types`, `bun run test:coverage`, and `bun run build` all pass
2. Create a PR from your feature branch to `dev`
3. Provide a clear title and description of your changes
4. Link any relevant issues
5. Wait for review — maintainers may request changes

## Code Quality

- No unused imports or variables
- No ad hoc `console.log` in application code; use the structured server telemetry helpers (deployment tooling may print non-secret status output)
- Database columns use `snake_case`; TypeScript fields use `camelCase`
- IDs use CUID2 via `@paralleldrive/cuid2`

## Reporting Issues

Use [GitHub Issues](https://github.com/mrdemonwolf/dirework/issues) to report bugs or request features. Report suspected vulnerabilities privately according to [SECURITY.md](SECURITY.md); never put secrets or exploit details in a public issue.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
