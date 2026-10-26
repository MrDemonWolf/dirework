# Example app screenshots

These screenshots show the actual DireWork UI with a synthetic Wolf Streamer account
and example tasks in a fresh, local D1 test database. The bot connection and replies
are mocked Twitch traffic. No real OAuth, Twitch account, production data, or live
service verification is involved. Secret URLs remain masked.

From the repository root, install Chromium once, build the local test worker, then capture:

```bash
bun run e2e:install
NEXT_PUBLIC_SERVER_URL=http://localhost:3000 bun run --cwd apps/web build:worker
bun run screenshots:capture
```

Ports 3000 and 3001 must be free. The command starts the existing isolated E2E workers,
uses test-only credentials, and writes `dashboard.png` and `theme-center.png` (1440×1000) and `bot-dock.png` (the
`?view=dock` page at a 360×760 OBS dock size) here, in dark mode with reduced motion. It must never
target a deployed instance. Review the resulting images before publishing them.
