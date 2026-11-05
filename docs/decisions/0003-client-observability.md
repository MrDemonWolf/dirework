# ADR 0003: Client observability

- Status: Accepted. Date: 2026-11-05.
- The owner approved the crash report in decision 4 on 2026-11-04. It is built: the `(overlay)`
  and `(bot)` error boundaries report through `apps/web/src/lib/crash-report.ts` and the
  `crash.report` procedure (`packages/api/src/routers/crash.ts`).

## Context

The api Worker writes one redacted JSON line per request and per metric or error event
(`apps/server/src/lib/logger.ts`, `telemetry.ts`). Workers Logs ingests those lines;
[ADR 0001](0001-cloudflare-services.md) §5 kept that over Analytics Engine. The browser
reports nothing. There is no Web Vitals or RUM script and no `window` error listener, and
every error boundary keeps its error to itself:

- `(overlay)/error.tsx` renders nothing and re-mounts after 10 s.
- `(bot)/error.tsx` restarts after 10 s; in the widget view it renders only a screen-reader
  line.
- `(app)/error.tsx` and `global-error.tsx` offer a retry.

An OBS overlay or the bot widget can therefore crash, re-mount and crash again every 10 s
with no signal anywhere. OBS and Moblin hide the browser console, and the streamer sees a
blank source.

Constraints:

- **One owner per instance.** There is no user population to sample, and the owner is the
  one at the dashboard.
- **Every report is a Worker request.** The Free plan allows 100,000 a day, and overlay
  polling already spends ~11,520 of them per 8-hour stream.
- **Overlay and bot page URLs carry bearer tokens in the path** (`/overlay/t/<token>`,
  `/bot/<token>`). A script that reports the page URL would send a token to a third party.
  These routes already send `Referrer-Policy: no-referrer` for the same reason.
- **Error messages can carry user text and URLs**: task text in a render error, an OAuth
  code in a fetch error. For that reason, `telemetry.ts` logs a server error by its name
  only.

## Decision

1. **No Web Vitals or RUM in the app.** With one owner, field data comes from one person's
   browser: it would add requests and settle nothing. CI gates the load paths instead:
   - `22-progressive` and `40-theme-center` fail on a painted skeleton.
   - `hydration.spec` fails on a hydration error.
   - `theme-flash` fails when a page paints the wrong theme before it hydrates.
2. **Cloudflare Web Analytics is optional, for the docs site only.** The docs are a static
   export on GitHub Pages, so the beacon costs no Worker request. Cloudflare describes Web
   Analytics as "free, privacy-first analytics" that "does not collect or use your visitors'
   personal data". An owner who wants docs traffic numbers can turn it on for the docs
   hostname. If that hostname is proxied through Cloudflare, use the automatic setup;
   otherwise add the snippet to the docs layout.
3. **Never a beacon on `/overlay/*` or `/bot/*`.** Those pages load no analytics script, no
   RUM and no third-party request: their paths are bearer tokens, and they run unattended
   for hours. In practice, never turn Web Analytics on for the app's hostname. On a
   hostname proxied through Cloudflare, the automatic setup (its default) injects the
   beacon into every HTML page, the token routes included. Today the app runs on
   `workers.dev`, where nothing is injected.
4. **Client errors are reported by `error.name` only.** Never the message, the stack, the
   component stack or the URL. The crash report applies this to the pages nobody watches:
   the overlay and bot error boundaries each send one report, shaped like this:
   - **Sent directly, fire-and-forget.** A crashed page doesn't poll: its queries never
     subscribe, and a bot that crashes while rendering has no heartbeat. A report that
     waited for the next poll could arrive minutes late, or never.
   - **At most one per page per 10 minutes.**
   - **No free text.** It carries a surface from a closed list (which overlay or which
     bot view), plus `error.name` matched against telemetry's label pattern
     (`/^[a-z0-9_.:-]{1,40}$/i`).
   - **Checked like the page's other requests**, so an overlay or bot page reports with its
     own token. The api logs it as one `client.crash` metric line in Workers Logs and
     writes nothing to D1.

   Cost: 0 requests while nothing crashes. A page stuck in a crash loop sends at most 144
   requests a day, with 144 D1 primary-key token reads. The dashboard's own boundary
   (`(app)/error.tsx`) sends nothing: the owner is looking at it.

## Consequences

- The crash report is the only client-to-api report: 0 requests while nothing crashes.
- A crash loop on an overlay or the bot page is no longer invisible: Workers Logs shows `client.crash` lines with the surface and
  the error name (kept 3 days on Free), which is enough to reproduce the crash locally.
- CI and the owner catch performance regressions; field data does not.

## Re-evaluate when

- People other than the owner start using the app beyond the static landing (for example,
  an interactive page for viewers), or a performance problem shows up that CI can't
  reproduce.
- Cloudflare changes what Web Analytics collects. Decide the docs question again then.
- Crash reports often hit their cap. Fix the crash, not the cap.

## Sources (read 2026-11-05)

- Cloudflare Web Analytics: `https://developers.cloudflare.com/web-analytics/about/` and
  `https://developers.cloudflare.com/web-analytics/get-started/`.
- AGENTS.md "Telemetry"; [ADR 0001](0001-cloudflare-services.md) §5 (Workers Logs on Free:
  3 days, 200,000 events a day).
