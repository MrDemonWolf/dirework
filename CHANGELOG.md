# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Viewer help that shows what to type.** `!help` now replies with a 3-step starter guide
  (add a task with `!task`, work along, finish with `!done`) instead of a list of command
  names. If you never edited your Help reply, it switches over on its own; your own wording
  is kept. New always-on `!dw help` posts the same guide even if you reworded `!help`, and
  `!dw help task` (or any command, or one of your aliases) explains one command in plain
  words with an example. `!dw commands` works like `!dwcommands`. If task commands are off,
  the guide says so instead of teaching commands that won't answer. Bot settings lists the
  `!dw` and `!dwhelp` commands in an **Always on** legend on the Task commands tab, which
  stays lit when you switch task commands off, and the Help reply is now labelled **Viewer
  starter guide**. Help costs no extra database reads.
- **Set up streaming checklist.** The dashboard opens with four steps: connect the bot
  account, then add the bot page, the timer overlay and the tasks overlay to OBS. Each OBS
  step hands you its URL (Show / Copy) and an **I added it to OBS** button; DireWork never
  guesses whether OBS has the page, so **Mark as not added** takes it back. **Finish later**
  hides the card (remembered in this browser) and the **Setup** button beside the greeting
  brings it back. It adds no polling: each click is one save.
- **A friendlier empty task board.** With no tasks the board asks *What are you working on
  today?*, offers an **Add a task** button that jumps to the add field, and reminds you
  viewers add theirs with `!task`.
- **Uptime probe workflow** (`.github/workflows/uptime.yml`). Set the repository variables
  `UPTIME_API_URL` and `UPTIME_WEB_URL` and GitHub Actions requests the API's `/ready` and
  the web app's `/api/version` every 30 minutes — 96 Worker requests a day, up to 288 while both are down and
  every probe retries — opening one
  issue labelled `uptime` while the instance is unreachable and closing it once it
  recovers. A free fallback when you don't run an external monitor; see the deployment
  guide's Monitoring section.
- **Mute switch.** A mod's `!mute` (or the new **Muted** switch at the top of Dashboard → Bot)
  pauses the bot: it ignores every command and posts nothing until a mod sends `!unmute` or
  you flip the switch back. The tasks and timer on stream stay as they are. The bot page shows
  **Muted** while it is.
- **Viewer block list.** A mod's `!block @user` (or the new **Moderation** card on Dashboard →
  Bot) makes the bot silently ignore that viewer's commands and removes every task they added.
  `!unblock @user` restores their commands, not their tasks. The streamer can't be blocked.
- **Permission badges in the command reference.** Mod-only commands (`!clear`, `!timer`, and
  the new moderation commands) carry a **Mods** chip on the Bot settings page.
- Browser end-to-end tests now cover the first-run claim page, starting and stopping a
  Pomodoro (including the ticking timer overlay), resetting an overlay URL, and signing out.
- Accessibility (axe-core, WCAG 2.1 A/AA) and phone-sized (Pixel 7) tests for the home page,
  dashboard, Theme Center and Bot settings.
- Install DireWork on your phone: the dashboard can be added to your home screen (Chrome on
  Android: menu, **Install app**; Safari on iOS: **Share**, **Add to Home Screen**) and opens
  straight to the dashboard in its own window, with a proper app icon and a status bar that
  matches the theme. There is no offline mode.
- Touch polish: larger tap targets for buttons and inputs on touch screens, and the header,
  footer, save bar and toasts stay clear of the notch and home indicator. A task's Activate
  and Remove buttons are now always visible on touch tablets, where they were hidden behind a
  hover that could never happen.

### Changed
- **No more preview URLs.** Both workers deploy with Cloudflare's version and preview URLs turned off.
  The production workers.dev addresses stay on, because OBS, the bot page and the web proxy use them.
- **OBS overlays check for changes every 5 seconds instead of every 3.** That is 40% fewer
  overlay requests (about 1.4k an hour for both overlays, down from 2.4k), leaving more of
  the free plan's daily budget. The countdown and ring still tick smoothly on their own;
  only a change such as starting, pausing or adding a task can take up to 2 seconds longer
  to appear.
- **Dashboard layout.** The timer console puts the clock on the left and the controls on
  the right: **Start**, **Skip** and **Stop**, then **Edit session settings**, which stays
  folded and shows the saved session at a glance (`FOCUS 25m · BREAK 5m · LONG 15m ·
  EVERY 4`), then the timer overlay's URL with its **Live preview** toggle. The task board
  takes two thirds of its panel with the tasks overlay's URL and preview beside it. Long
  tasks wrap to two lines, rows are easier to tap, and each author's group folds from its
  header. **Clear done** and **Clear all** moved into the board's options menu (each still
  asks first), and the bot's status shows once, on the bot strip. No new requests.
- **The claim page leads with the claim.** `/setup` now reads "Claim your DireWork
  instance", says in two sentences that the first Twitch sign-in becomes the owner and how
  to recover if someone else gets there first, and shows the Claim with Twitch button, an
  example of the timer and task overlays, and the three steps that come after the claim
  (connect the bot account, add the overlays to OBS, viewers join from chat). A failed
  sign-in shows the same notice as the home page, and the header's own Sign in button steps
  aside on this page. The page is server-rendered and makes no API calls.
- **Theme Center gallery and sections.** Presets are a grid instead of a sideways-scrolling row
  (arrow keys move between them, Up/Down by row). The editor's tabs are **Timer style**,
  **Task style** and **Phase labels**, each with a dot while it holds unsaved edits. Style tabs
  are split into **Colors**, **Typography**, **Layout** and **Opacity** (Colors open first),
  grouped by the part of the overlay they change. A section's menu has **Reset section**, and
  the page menu has **Reset theme to Default**; both confirm and only change the draft until
  you save.
- **Theme Center preview.** The preview now shows one overlay at a time (**Timer** or
  **Tasks**), adds a **Bright** backdrop (a sunny camera feed) to dark, light and checkerboard,
  draws the task list at the 700 × 800 source size scaled to fit, and uses the same demo session
  as the landing page and docs. A chip says whether you are **previewing unsaved changes** or
  the preview **matches the saved theme**, and the save bar says unsaved edits are **not on
  stream yet** and that saving updates both OBS overlays. On wide screens the preview is a
  fixed-width column that stays in view while you scroll the editor.
- Docs: every web component now has one spec in `design-system/components/` (purpose,
  anatomy, props, states, accessibility, do and don't), with a page-to-components map in
  its README and the index on the Design System docs page. The timer and task overlay
  specs match the refreshed renderers, and the stale `dw-*` Button, Card and Pill specs
  are gone (listed under Legacy on the docs page). A unit test fails when a component has
  no spec, a spec points at a missing file, or an overlay default drifts from its spec.
- Docs: an architecture decision record (`docs/decisions/0001-cloudflare-services.md`)
  weighs KV, Durable Objects, Queues, Cron Triggers and other Cloudflare services against
  the Free-plan limits. Nothing changes today; a server-hosted bot on a Durable Object is
  the one experiment it recommends.
- **Builds no longer download fonts.** The dashboard and docs site now load Montserrat and
  IBM Plex Sans/Mono from self-hosted files (`packages/fonts`, about 104 KiB) instead of
  fetching them from Google Fonts at build time, so a build can't fail because Google was
  unreachable from the runner. The faces and weights you see are unchanged.
- **Token sweep (no visual change).** The web app's arbitrary type, tracking, z-index, width
  and gray-palette classes now use design tokens (new: `tracking-eyebrow`/`marquee`,
  `rounded-xs`, the `console-*` bot-console colors), and `token-bypass.test.ts` keeps it so.
- **The home page is now a viewer landing.** Only people who don't own your DireWork see `/`
  (you go straight to the dashboard), so it now explains what they're looking at: a still of a
  co-working stream (timer, task list, chat), the `!task` / `!today` / `!done` commands, and
  links to deploy their own copy. "Sign in with Twitch" stays as a small owner-only button, and
  the header no longer shows a second one there. Someone refused because the instance is
  already claimed now gets a link to the deploy guide. The page is server-rendered and makes
  no API requests. Its docs links follow your `DOCS_URL`, which the web worker now receives
  too.
- **One tagline everywhere:** "A focus timer for your Twitch stream." The docs home page,
  the web app's link previews and both share cards now use the same words, and both share
  cards are navy and cerulean with the same example timer (18:24, Cycle 2 / 4).
- The docs home page mocks (stream scene, task list, timer and chat preview) now show one
  example session, and the chat preview's bot replies are the bot's real default replies.
- Test coverage floors now sit about five points under the measured coverage in every
  package (api, server, web, infra, and db, which gained tests for its default replies and
  the provisioning helper). Untested code now drops the number past the floor and fails
  CI instead of slipping under a bar set forty points too low.
- CI no longer re-verifies `main` on push: a push there is a merge, and the deploy
  workflow runs the same verification itself, so each merge runs the pipeline twice
  instead of three times.
- The historical planning documents (migration plan, pre-migration audit, marketing
  review, logo prompt) moved from the repository root to `docs/history/`.
- The inline `!dwhelp` command list (shown when no docs URL is configured) now includes
  `!block`, `!unblock`, `!mute` and `!unmute`.
- `mute`, `unmute`, `block` and `unblock` are now built-in command names, so they can't be
  used as alias names.
- Overlay presets refreshed: thicker ring, larger countdown and task text, fewer outlines, no
  pulsing glow; instances that never customized a style value pick the new defaults up
  automatically. The active task is now a soft tint with an "Active" label, and a list with
  scrolling off shows "+N more" when tasks are cut off.
- The landing page and dashboard preload their heading font, and only the overlay pages and
  the Theme Center load the overlay font stylesheet, so each page downloads only the type it
  shows. The public pages (`/`, `/setup`) show a loading skeleton the moment you navigate to
  them.
- Account menu trimmed (no duplicate avatar header); menu items highlight with a fill
  instead of a boxed outline; active task rows lose the coloured edge bar; mobile nav
  closes on Escape and navigation.
- Subtler, consistent motion across menus, dialogs, task rows and status chips (CSS only,
  honours reduced-motion).

### Fixed
- **`!done #2` finishes task #2.** `!today` shows task numbers as `#2`, but typing them back
  that way made `!done` complete your current task instead, with a cheerful reply.
  `!done`, `!edit`, `!remove` and `!focus` now accept `#2` as well as `2`, and `!done`
  followed by anything that isn't a number replies with how to use it instead of finishing
  the wrong task.
- **`!timer` says why nothing happened.** Pausing a paused timer, resuming a running one, or
  asking for the ETA while paused all used to answer "The timer isn't running", and a
  pause or skip that lost a race with another action answered "Done." anyway. The bot now
  says the timer is already paused or already running, reports the frozen time left while
  paused, and says when the timer changed underneath a command.
- **`!check @user` and `!clear @user` read the name the way `!block` does.** A trailing `?` or
  `,` no longer breaks the lookup, `!check viewer` without the `@` checks that viewer instead
  of showing your own task, a name that can't be a Twitch login gets a usage hint, and
  `!clear @user` says so when that viewer had no tasks.
- `!task` and `!next` read the streamer's account once per chat line instead of twice.
- **Theme Center and Bot settings open on your saved values.** Both editors used to render
  the stock defaults first and swap in the saved theme or messages a moment after the page
  loaded (the server HTML carried the defaults too). They now start from the saved values,
  so nothing flickers on load and an edit made right away can no longer be mangled by the
  swap.
- **Deploys behind Cloudflare Access end green again.** With Access in front of `/rpc/*`,
  the post-deploy smoke check followed the redirect to Access's login page, saw `200` and
  failed every deploy. The `/rpc/user.me` probe no longer follows redirects and passes on
  either a `401` from the proxy or a redirect to an `https://*.cloudflareaccess.com` login
  page, naming which in its output; a `200`, a `5xx` or a redirect anywhere else still
  fails. The home probe likewise accepts an unclaimed instance's `/` → `/setup` redirect
  when Access fronts `/setup`. Keep `/`, `/api/*`, `/bot/*` and `/overlay/*` outside
  Access.
- The Theme Center preview's **Dark** and **Light** backdrops showed the panel color instead:
  the class merge dropped them. They now paint the simulated scene.
- On a phone the Theme Center was wider than the screen (the preset row stretched the page),
  so it scrolled sideways. It now fits.
- Small labels on the docs home page were 10–11px; they are now at least 12px. Headings
  there no longer ask for font weights the page never loads.
- The dashboard, Theme Center and Bot pages no longer throw away their server render when your
  OS colour scheme differs from the app theme. The page was being drawn a second time in the
  browser, briefly showing every control twice.
### Upgrade notes
- Database migration `0019_bot_mute_blocklist` applies automatically on the next deploy. It
  only adds two columns to `bot_config` (`muted`, `blocked_viewers`), so rolling the workers
  back stays safe.
- After updating, reload the bot page (or refresh its OBS browser source) so it shows the
  **Muted** status and relays the new commands.

### Fixed
- A hard reload in dark mode no longer flashes white: the saved theme is now applied in the
  page `<head>` before anything paints, the page canvas itself takes the theme colour, and
  the header's light/dark switch shows the right position from the first frame.
- The dashboard, Theme Center and Bot settings now arrive with their data: the server fetches
  your session, timer, tasks and settings in one batched call and streams the finished page —
  no skeleton hand-off, no idle "Ready 25:00" flash, navigation present on first paint. A
  dashboard load makes 2 API requests instead of 7.

## [2.0.0] - 2026-10-20

Why 2.0.0: deploying this release needs a new required secret (`PROXY_SECRET`) and moves the
deploy job into a `production` GitHub environment, so every fork's deploy setup changes. Nothing
changes for viewers, and your tasks, settings and bot connection carry over.

### Upgrade notes
- **New required GitHub secret `PROXY_SECRET`** (min 32 characters,
  `openssl rand -base64 32`). Add it **before** syncing your fork — the deploy fails
  validation without it. It lets the API rate limiter tell browsers apart behind the web
  worker's proxy.
- **Recommended: move your deploy secrets into a `production` environment.** The deploy
  job now runs in the GitHub environment `production`. Create it under **Settings →
  Environments**, add the seven deploy secrets there, then delete the repository-level
  copies so no other workflow can read them. Nothing breaks if you wait: until you move
  them, the deploy keeps reading the repository secrets.
- Database migrations `0012`–`0017` apply automatically on the next deploy. `0012`–`0016` only
  add tables, columns and indexes, plus a one-time scrub of data DireWork no longer keeps (see
  Security). `0017` drops one index, `task_status_idx`, which `0015`'s `task_status_completed_idx`
  already covers; no shipped build relies on it, so rolling the workers back after this deploy
  stays safe.
- After updating, reload the bot page (or refresh its OBS browser source) so it runs the
  new bot code.

### Security
- **Resetting the bot page URL now also kills the Twitch chat login that page was
  given**, so a leaked bot link stops working in chat too, not just on DireWork. The bot
  keeps running with a freshly issued login once you open the new URL. If Twitch can't be
  reached, the reset still goes through and the dashboard tells you the old chat login
  couldn't be confirmed dead (it expires on its own within a few hours).
- Cloudflare **invocation logs are turned off** on both workers. They stored every
  request's full URL, and bot and overlay links carry their secret token in the URL.
  DireWork's own redacted logs and error metrics are still collected.
- DireWork stores less about you: owner sign-in asks Twitch only for your identity (no
  email), your own Twitch login tokens are never saved, and sessions no longer record your
  IP address or browser. Data saved by earlier versions is scrubbed on deploy.
- Anyone else who tries to sign in to a claimed instance gets a clear "already belongs to a
  different Twitch account" message, and the deployment guide explains how to recover an
  instance someone else claimed first.
- Hardened the API: dashboard changes must be sent as JSON (blocks cross-site form
  posts), batched requests are capped, the local development login needs a per-run secret,
  and every call to Twitch has a timeout.
- New CodeQL security scanning and a daily dependency audit; patched vulnerable
  dependencies, including Next.js.

### Changed
- **Deploys are guarded harder.** A deploy runs only from `main` (a manual run from any
  other branch is refused before it starts); both Worker bundles must fit a 2560 KiB
  compressed budget before anything ships (the free plan rejects a Worker over 3 MiB, and
  only after the database migrations have run); and the post-deploy check now also confirms
  the rate-limit bindings attached (`/ready` reports `limits`), that the home page renders,
  and that the dashboard's API proxy answers. The browser test suite gates every pull
  request and app deploy (docs publishes skip it) with the browser download cached between
  runs, and a manual deploy can skip it with `skip_e2e` for a hotfix.
- **Bot settings page redesigned.** The bot console and bot account cards sit side by side,
  with a numbered "How to run it in OBS" guide. Each command tab shows a compact command
  legend next to the reply editor; every reply has a live preview with sample values, a
  "Reset to default" once you have changed it, and variable chips that explain themselves
  on hover.
- **Default bot replies reworded** in plain language ("Nice work, {user}. \"{task}\" is done." instead of "Alpha work! You finished \"{task}\" {user}!"), and the default `!help` reply now lists `!focus`, `!check`, `!today` and `!next`. If you never edited a reply, your bot picks the new wording up on its own, including instances set up before 1.1 that still had the original 2025 text. Replies you customized are untouched.
- `!today` shows each task's number (`Now: #2 … · Next: #1 …`), the number `!done`, `!edit`, `!remove` and `!focus` take.
- The footer shows the deployed commit hash on its own, without a version number. Every deploy is one commit, so the hash is the version that matters.
- **The product name is spelled "DireWork" everywhere** in the dashboard, overlays and docs.
- **An overlay with an old or reset URL now shows nothing** instead of a fake 00:00 timer or
  "No tasks yet", so a stale OBS source can never put placeholder junk on stream. Copy the
  current URL from the dashboard to bring it back.
- **"Username color" is now "Fallback username color"**, with a hint: it only applies to
  viewers who have no Twitch chat color.
- **Theme presets meet text contrast guidelines (4.5:1)** for done tasks, usernames and the
  Cozy Cottage header. Done rows no longer fade to 60% opacity, so the done color you pick is
  the color viewers see.
- **The bot page only forwards real DireWork commands.** Lines whose first word isn't a
  DireWork command or one of your aliases — like other bots' `!lurk` or `!so` — never leave
  the page, saving a Cloudflare request each. An open bot page picks up new aliases within
  an hour; reload it to use them right away.
- Completed tasks are deleted automatically 24 hours after they're marked done, and the
  task overlay and dashboard read at most the 50 most recent done tasks per poll (the
  `done/total` counters, including each viewer's, still count every done task) — keeps D1
  reads within the free tier.
- The dashboard stops polling while its tab is hidden and slows down after two minutes
  without input, so an idle dashboard no longer eats into the daily request budget.
- The API rate limiter keys signed-in traffic by session and proxied traffic by the
  browser's real IP, so other visitors can no longer exhaust the owner's buckets.
- Deploys no longer fail on a newly published dependency advisory; they show a warning.
  Pull requests still fail on high-severity advisories.
- Every deploy ends with a smoke check (the API must reach the database and the web app
  must serve the new version), so a broken deploy shows red instead of green.
- Clearer error messages: bot connection failures, rejected settings fields and lost API
  connections each get specific, readable copy, and editors never open over default values
  when loading failed.
- Accessibility fixes for keyboard focus and color contrast across the dashboard.
- Contributor docs: `AGENTS.md` now has a Code Review Rules checklist (free-tier cost
  budget and invariants) used for every pull request review.
- Design tokens: `design-system/tokens.json` now generates the color, radius, type and
  motion CSS for both the app and the docs site (`bun run tokens`), so the two can no
  longer drift apart. No visual change.

### Added
- Dashboard setup checklist groundwork: DireWork now remembers which setup steps you have
  confirmed by hand (bot page added to OBS, timer overlay added, task overlay added).
  Migration `0018` adds three flags to `instance_config`; the API returns them with
  `user.me` and `user.confirmSetupStep` saves one per click. The checklist itself in the
  dashboard comes in a later update.
- Browser end-to-end tests in CI (`packages/e2e`, Playwright): both workers run in local workerd over a fresh database, the suite signs in through the development bypass, and it exercises the dashboard, task list and overlay, Theme Center and Bot settings before anything can deploy.
- Dashboard pages show their loading skeleton the instant you click a nav link, instead of
  the previous page sitting still until the new one arrives. The clicked nav icon pulses
  while the page loads, and skeletons sweep a soft highlight instead of pulsing.
- **`!today` chat command.** A viewer gets their plan in one line: the task they're on
  now, the next two, and how many more are queued. It can be aliased like any other
  command (reload the bot page after updating so it relays `!today`).
- **Undo for removing a task.** Removing a task is still one click; a "Task removed" toast
  offers Undo for a few seconds and puts it back exactly where it was.
- **Rolling back** section in the deployment guide: how to roll each worker back from the
  Cloudflare dashboard, `wrangler rollback`, or a re-run of an earlier GitHub deploy, and
  why the database itself should not be rolled back.
- Deployment guide sections on monitoring (point uptime checks at `/ready`, which tests
  the database), updating your instance, and recovering an instance someone else claimed.

### Fixed
- `!remove` and `!focus` without a number used to answer with one shared line that named both commands and sent viewers to `!check` for their numbers, which `!check` never shows. Each now explains its own usage and points at `!today`.
- A mod's `!clear` with no target did nothing. It now lists the targets: `!clear done`, `!clear all`, `!clear @user`.
- Two open bot pages no longer run each chat command twice.
- The bot reconnects on its own when the Twitch chat connection silently drops, re-sends a
  reply Twitch rejected as a duplicate, and explains chat-mode, ban and timeout errors.
- When the bot account's Twitch login can no longer be refreshed, the bot page shows a
  clear "reconnect the bot account" screen instead of retrying forever.
- The bot joins the right channel after you rename your Twitch account.
- The bot page no longer stalls when one API request hangs: requests time out after 30
  seconds and later chat commands keep processing.
- When a bot-login refresh fails, other waiting requests report the failure at once
  instead of reusing the rejected token; a reconnect also clears any stuck refresh lock.
- The bot page stops on a clear error for a malformed bot link or invalid IRC credentials
  instead of sitting on "Refreshing login".
- Disconnecting the bot account always finishes, even when Twitch is slow.
- A failed bot connection is reported as an error instead of "cancelled".
- Overlays keep showing their last good state through a failed poll or a page error
  instead of going blank on stream.
- Long task text from chat is cut without breaking an emoji in half.
- The "Retry" button on a failed-load toast works again.

## [1.1.0] - 2026-07-10

### Changed
- **Rebuilt on Cloudflare Workers** — the entire stack moved from Node.js + PostgreSQL +
  Docker to Cloudflare Workers + D1 (SQLite) + Hono, deployable on the free plan
  - Two workers (`dirework` web via OpenNext, `dirework-api` Hono) + D1, managed by Alchemy
  - Twitch chat bot now runs in a token-gated browser page (`/bot/<token>`) holding the
    IRC WebSocket — add it as an OBS browser source or pinned tab; command logic runs
    server-side via `bot.ingest`
  - Overlays switched from Server-Sent Events to polling with local countdown
  - Auth and dashboard API calls proxy same-origin through the web worker (workers.dev
    cookie isolation); overlays and the bot page talk to the API worker directly
  - Mutation logic extracted into shared services used by both the dashboard API and chat
    commands; timer/task command drift bugs fixed along the way
  - Security hardening from the pre-migration audit: bot OAuth tokens no longer sent to
    the browser, constant-time token comparison, bounded public inputs, chat task length
    and per-user caps
  - CI deploys on push to `main` via GitHub Actions + Alchemy
- Removed Docker, Docker Compose, Coolify, and PostgreSQL deployment paths (see the new
  Cloudflare deployment guide)
- Rewrote Getting Started, Deployment, and reference docs to match the real stack (Bun + Drizzle on Cloudflare D1 + Alchemy/Cloudflare Workers), correcting stale pnpm/Prisma/nixpacks instructions
- Corrected the bot OAuth callback path in docs to `/api/bot/callback/twitch`
- Consolidated duplicated timer formatting and route session guards into shared helpers (`formatClock`, `requireSession`)

### Added
- Single-owner architecture with a first-time setup flow — the first Twitch account to sign in claims the instance
- Redesigned documentation landing page with a "focus console" theme, three-step quick start, and ADHD-friendly copy
- Branded loading state (focus-ring spinner) and a warmer first-time setup screen
- Shared `DEFAULT_PHASE_LABELS` constant and Twitch brand color token to keep timer labels and buttons consistent
- Footer version readout (`v<version> · <commit>`) that polls the live deploy and
  prompts a **Reload** when a newer build has shipped — DireWork runs as a rolling
  build off `main`, so an open dashboard tab can outlive its own code

### Removed
- Dropped the never-implemented `ALLOWED_TWITCH_IDS` allowlist from docs and examples — single-owner login already restricts access

## [1.0.0] - 2026-02-12

### Added
- Pomodoro timer with configurable work/break/long break durations, automatic phase transitions, and cycle tracking
- Task list with Twitch chat integration — viewers add and manage tasks via chat commands
- OBS overlays (timer + task list) with transparent backgrounds and real-time SSE updates
- Timer overlay supports circle and rounded rectangle (squircle) progress ring shapes
- Task list overlay groups tasks by author with styled card containers and per-author done/total counts
- Scroll enabled/disabled toggle for task list overlay
- Twitch chat bot with configurable commands for tasks (!task, !done, !edit, !remove, !check, !next) and timer (!timer start/pause/resume/skip, !time, !eta)
- Bot account connection via separate OAuth flow with error feedback
- 18 customizable task bot response messages and 14 timer bot response messages
- Enable/disable toggles for task and timer command groups
- Command alias system for remapping bot commands
- Theme Center visual style editor with 11 presets (Default, Liquid Glass Light/Dark, Neon Cyberpunk, Cozy Cottage, Ocean Depths, Sakura, Retro Terminal, Minimal Light, Sunset, Twitch Purple)
- Timer preview animation toggle in Theme Center (play/pause live countdown simulation)
- Phase Labels editor for customizing timer overlay state labels (Focus, Break, Long Break, etc.)
- Dashboard with timer controls, task manager, overlay previews, and live timer status badge
- Task manager groups tasks by author with per-author pending/done counts
- Bot Settings page with two-column layout: sticky sidebar (bot account, toggles, aliases) + scrollable message editors
- Variable/placeholder reference panels in bot settings UI
- Overlay access via UUID tokens (no auth required), regenerable per user
- Server-Sent Events (SSE) for overlay real-time updates via tRPC subscriptions
- Tooltip component with glass styling on timer config labels
- Mobile hamburger navigation menu
- Skeleton loading states for dashboard, styles, and bot settings pages
- Sticky save/reset bars when unsaved changes exist
- Self-hosted single-user per instance with Twitch OAuth login
- CI/CD pipeline (GitHub Actions) with type-checking, build, and tests (Drizzle is schema-as-code, no codegen step)
- Vitest unit tests for config defaults, deep merge, config types, and theme presets
- Fumadocs documentation site with macOS 26 Liquid Glass purple theme
- Documentation covering getting started, features, deployment, chat commands, overlays, environment variables, Twitch OAuth, and troubleshooting
- Full SEO metadata (OpenGraph, Twitter cards, keywords) on documentation site
- Coolify deployment guide with Docker and PostgreSQL setup

### Architecture
- Turborepo + Bun workspaces monorepo with ESM throughout
- Next.js 16 (App Router) with React 19, React Compiler, and typed routes
- tRPC v11 with httpBatchLink, httpSubscriptionLink (SSE), and splitLink
- Better Auth with Twitch social provider (30-day sessions)
- Drizzle ORM with PostgreSQL 17 and 4 focused config models (timerConfig, timerStyle, taskStyle, botConfig)
- All config columns have Drizzle defaults — rows lazily provisioned on first access
- API maps flat DB columns to nested frontend objects via build/flatten helpers
- Overlays receive pre-built nested config objects from public API procedures
- In-process EventEmitter bus for SSE event routing
- Tailwind CSS v4 with shadcn/ui (base-lyra style) and Lucide icons
- Fumadocs documentation with Orama search, deployed to GitHub Pages
