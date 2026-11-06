# ADR 0002: Rendering and caching on OpenNext

- Status: Accepted. Date: 2026-11-05.
- Checked against the installed `next` 16.4.5 and `@opennextjs/cloudflare` 1.20.16, and
  against the pages and issues under Sources, on 2026-11-05.

## Context

The web Worker (Next 16 through `@opennextjs/cloudflare`) renders every app page per
request. Pages arrive complete: the `(app)` layout holds its shell until the page's data is
in (`lib/shell-hold.ts`; a finished page also blocks the first paint until the document is
parsed, with a `rel="expect"` render gate), and only a section slower than 800 ms streams in
afterwards (`lib/progressive.ts`). AGENTS.md "Shell hold" and "Progressive sections" explain why: a
streamed skeleton stayed on screen for ~300 ms because of React's reveal throttle.

The incremental cache is OpenNext's read-only static-assets cache
(`apps/web/open-next.config.ts`). It serves the routes prerendered at build (the share card
and the other metadata routes). Nothing writes to it at runtime: there is no ISR,
`revalidate` or `"use cache"`, and the server's own fetches pass `cache: "no-store"`
(`lib/server-session.ts`, `lib/server-trpc.ts`). It costs no KV, R2, D1 or Durable Object
operation.

The 2026-11-04 frontend audit raised two questions:

1. Should DireWork turn on Cache Components (`cacheComponents`: Partial Prerendering plus
   `"use cache"`) and Partial Prefetching (`partialPrefetching`)? They serve a prerendered
   static shell and stream the rest. Next's docs say "Both features will be enabled
   everywhere in the next major release, and the options will be removed", so the question
   comes back with that release.
2. Which pages should the browser's back/forward cache (bfcache) keep? Nobody had recorded
   the question.

## Decision

### 1. No Cache Components or Partial Prefetching yet

`apps/web/next.config.ts` sets neither `cacheComponents` nor `partialPrefetching` (nor the
deprecated `experimental.ppr` or `experimental.useCache`) while both of these hold:

- **The adapter can't serve them.** `@opennextjs/cloudflare` has no released Cache
  Components support. PR #1318 ("run Cache Components staged renders correctly on workerd")
  is still open. Open issues report 500s and worker hangs (#1450) and a `"use cache"` dedupe
  hang on Next 16.4 (#1464). Next's own docs say Cache Components "requires the Node.js
  runtime" and "Other server-side JavaScript runtimes are not guaranteed to work."
- **The incremental cache is the read-only static-assets cache.** It has no `"use cache"`
  (composable) support. In 1.20.16, `getAssetUrl` throws "Composable cache is not supported
  in static assets incremental cache" (the read logs it and misses), and `set` only logs that
  the cache is read-only. Every `"use cache"` entry would therefore miss on every request.
  OpenNext's caching guide adds: "Revalidation is not supported with this cache", and "cache
  interception does not work with PPR".

`apps/web/src/lib/__tests__/rendering-and-caching.test.ts` fails, and points here, if either
flag appears in `next.config.ts` or the incremental cache changes.

Staying put costs nothing: every page stays per-request, as it is today.

### 2. Back/forward cache, page by page

Since 2025, Chrome keeps even `Cache-Control: no-store` pages in bfcache, with exceptions:

- It evicts such a page when a cookie changes.
- It evicts it when the page makes a fetch or XHR whose response is also `no-store`.
- A WebSocket, WebTransport or WebRTC connection keeps a page out.
- It drops a `no-store` page after 3 minutes.

Every DireWork HTML response is `no-store`. Pages get Next's dynamic default
(`private, no-cache, no-store, max-age=0, must-revalidate`), and `next.config.ts` sets
`no-store` on `/dashboard`, `/overlay`, `/bot`, `/rpc` and `/api`.

| Pages | Restored from bfcache? | Why |
| --- | --- | --- |
| Dashboard, Theme Center, Bot settings | No, by design | They poll `/rpc` (`no-store`) every 2–15 s (`poll-intervals.ts`), so Chrome evicts them. A restored snapshot would show a stale timer and task list anyway. Back and Forward between them are client navigations through Next's router cache, which bfcache does not affect. |
| Overlays (`/overlay/*`) | Doesn't matter | OBS and Moblin never navigate back. |
| Bot page (`/bot/*`) | No | While it runs it holds the Twitch IRC WebSocket, and a running bot must not be frozen anyway. |
| Landing (`/`), `/setup` | Yes, keep it | These are static server components with no queries. Since DireWork PR #246 the version check runs only for the signed-in owner, and both pages redirect the owner, so nothing on a viewer's tab fetches after load. |

The landing was measured against production on 2026-11-05 with headless Chromium 156.
Playwright's switch that turns bfcache off was removed for the test. After leaving `/` for
another site and pressing Back, the page came back from bfcache in 15 of 20 runs: `pageshow`
had `persisted` set, and no new document request was made. Where Chrome showed its reasons,
they were only circumstantial ones (`TimeoutPuttingInCache`,
`NavigationCancelledWhileRestoring`), never a `no-store` reason.

**Rule:** a viewer page (`/`, `/setup`) never polls, opens a socket, or makes a `no-store`
fetch after load. The planned static `version.json` is served `no-cache`, so a check becomes
an ETag revalidation instead of a `no-store` fetch. That keeps the rule true even if the
version check ever runs there. Until it lands, turning the check on for viewers would cost
these pages bfcache. To re-check, open Chrome DevTools → Application → Back/forward cache →
Test back/forward cache; it lists any blocking reason.

## Consequences

- No change to behaviour or cost; the only code is the pin test above.
- Every app page stays per-request SSR, so a cold web Worker isolate pays for the full
  render. See the CPU baseline in [production readiness](../production-readiness.md).
- The landing stays restorable from bfcache only while viewer pages follow the rule above.

## Migration work, when a trigger below fires

- **The `(app)` layout's session read.** `await getServerSession()` in `(app)/layout.tsx`
  has no Suspense boundary above it, so nothing above it can be static. Wrap the read in
  Suspense with a signed-out header as the fallback.
- **The bot page's `searchParams`.** `/bot/[token]` awaits `searchParams` in the page, with
  no Suspense or `loading.tsx` above it (there is no root or `(bot)` one). Pass
  `searchParams` to a Suspense child instead.
- **Shell hold.** Decide it again against Partial Prefetching. A static shell paints its
  Suspense fallbacks first, and React's reveal throttle would bring back the skeleton flash
  that shell hold removed. `40-theme-center` and `22-progressive` fail on a painted skeleton.
- **Polls and timers under `<Activity mode="hidden">`.** With Cache Components, Next keeps
  recently visited routes mounted but hidden: it cleans up their effects and recreates them
  on return. Check every poll and timer under it (`poll-intervals.ts`, `bot-presence.ts`,
  `version-check.ts`, and the day rollover in `stats-view.ts`).
- **A writable incremental cache, only if `"use cache"` is actually used.** OpenNext does "not
  recommend using KV because it is eventually consistent". R2 needs a
  `NEXT_INC_CACHE_R2_BUCKET` binding plus a `WORKER_SELF_REFERENCE` service binding. The
  memory queue "is not fully suitable for production deployments". The Durable Object queue
  falls outside AGENTS.md's "Code Review Rules". Any of these needs the budget review that
  [ADR 0001](0001-cloudflare-services.md) requires.

## Re-evaluate when

- `@opennextjs/cloudflare` releases Cache Components support (#1318 shipped), and the hangs
  in #1450 and #1464 are fixed.
- The next Next major turns both features on and removes the options. Do the migration work
  above before that upgrade.
- DireWork needs ISR, revalidation or `"use cache"`. A writable cache comes first.
- A viewer page starts polling or fetching, or Chrome changes its `no-store` rules. Re-check
  bfcache then.

## Sources (read 2026-11-05)

- Next.js `cacheComponents`:
  `https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents` (updated
  2026-10-15). Option names: `next/dist/server/config-shared.d.ts` in 16.4.5.
- OpenNext: `https://opennext.js.org/cloudflare/caching`; and
  `dist/api/overrides/incremental-cache/static-assets-incremental-cache.js` in
  `@opennextjs/cloudflare` 1.20.16.
- `github.com/opennextjs/opennextjs-cloudflare`: PR #1318 and issues #1450 and #1464, all
  open.
- Chrome: `https://developer.chrome.com/docs/web-platform/bfcache-ccns` (updated
  2025-09-09).
