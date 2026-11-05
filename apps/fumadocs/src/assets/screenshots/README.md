# Example app screenshots

These screenshots show the actual DireWork UI with a synthetic Wolf Streamer account
and example tasks in a fresh, local D1 test database. The bot connection and replies
are mocked Twitch traffic. No real OAuth, Twitch account, production data, or live
service verification is involved. Secret URLs remain masked.

The docs import them (`content/docs/features.mdx`, `src/app/(home)/page.tsx`), so each is
published once, content-hashed under `/_next/static/media/`. Keep them here, not in
`public/`, which would publish a second, unreferenced copy. They are lossless WebP: pixel-exact,
so small UI text stays sharp, and 58% smaller than the PNGs they replaced.
`packages/infra/__tests__/docs-images.test.ts` holds that (lossless, at most 96 KiB each, no
PNG screenshot referenced, nothing in `public/screenshots`).

From the repository root, install Chromium once, build the local test worker, then capture:

```bash
bun run e2e:install
NEXT_PUBLIC_SERVER_URL=http://localhost:3000 bun run --cwd apps/web build:worker
bun run screenshots:capture
```

The conversion needs `cwebp`, libwebp's encoder (`brew install webp` or `apt install webp`).
Ports 3000 and 3001 must be free. The command starts the existing isolated E2E workers, uses
test-only credentials, captures `dashboard` and `theme-center` (1440×1000) and `bot-dock`
(the `?view=dock` page at a 360×760 OBS dock size) in dark mode with reduced motion, and
converts each PNG with `cwebp -lossless -z 9` into a `.webp` here. The PNGs stay in
`packages/e2e/test-results`. It must never target a deployed instance. Review the resulting
images before publishing them.
