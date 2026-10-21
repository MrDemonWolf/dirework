# ADR 0001: Which Cloudflare services Dirework uses beyond Workers and D1

- Status: Accepted (no code change now; one experiment proposed). Date: 2026-10-20.
- Limits below were read on developers.cloudflare.com on 2026-10-20 (sources at the end).

## Context

Dirework runs on two Workers (web, api) and one D1 database on the Workers Free plan. The
owner asked whether KV or other Cloudflare services make sense, since "we use D1 for
everything". AGENTS.md says "free plan — no Durable Objects" and the review rules forbid
"cron triggers, Durable Objects, Queues, or other paid/metered bindings". Those lines were
written when Durable Objects and Queues were paid-only. Both now have Free allowances, so
the rule needs a reason, not just a price.

Today's load, for one streamer on an 8-hour stream:

| Traffic | Path | Worker requests | D1 work per request |
| --- | --- | --- | --- |
| Timer overlay poll, every 5 s (`OVERLAY_POLL_MS`) | browser → api via `publicTrpc` | 5,760 | token check, then 3 parallel reads (state, config, style) |
| Task overlay poll, every 5 s | browser → api | 5,760 | token check, style, then open tasks + ≤50 done + index COUNTs |
| Dashboard, active (timer 2 s + tasks 3 s, billed twice via `/rpc`) | browser → web → api | 100 per minute | as above, owner-gated |
| Dashboard, idle (15 s, billed twice) | browser → web → api | 16 per minute | as above |
| Chat command | Twitch IRC → bot page → `bot.ingest` | 1 per command | dedupe batch (`processed_chat_message`), then command logic |

The two overlays alone are ~11,520 of the 100,000 requests/day Workers Free allows. Each
api request makes 2–3 sequential D1 round trips. Housekeeping is lazy: the done-task purge
runs on task and timer writes (`purgeExpiredDoneTasks`), dedupe pruning rides in the same
batch as each claim (`chat-dedupe.ts`), and the owner token scrub runs once per deploy
(`packages/infra/post-deploy.ts`) and at sign-in. None of it costs an extra request.

The Twitch bot is a browser page (`/bot/<token>`, `irc-client.ts` + `bot-session.ts`). It
only runs while that page is open in OBS or a pinned tab. This is the main operational
pain: forget the page and the bot is silent.

## Options considered

### 1. Workers KV for config, styles, sessions or bot config: rejected

Free: 100,000 reads/day, "1,000 writes per day" to different keys, "1 per second" to the
same key, 1 GB storage. KV is "eventually-consistent"; a change can take "up to 60 seconds
or more to be visible in other global network locations".

- Every task add, done, timer start/pause/skip and style save is a write. Thirty viewers
  each adding and finishing two tasks is already ~120 writes before any timer change.
  1,000/day is too tight for live state, and the 1 write/s per-key cap breaks bursts of
  `!task` lines.
- A 60 s stale read breaks the timer: the overlay computes the countdown from
  `targetEndTime`, so a stale pause or skip shows the wrong clock for up to a minute.
- Caching only the rarely written rows (styles, timer config) in front of D1 saves D1 rows
  we are nowhere near limiting (5M/day), spends a KV read per poll against a 100k/day KV
  budget (11,520 per stream for overlays alone), and adds invalidation code.
- Sessions: better-auth reads one indexed D1 row; KV would add a stale window after sign-out.

Where KV would fit: immutable, read-heavy data that changes once per deploy. Workers static
assets (`_headers` marks `/_next/static/*` immutable) and OpenNext's static-assets
incremental cache already cover that at no request cost. Nothing in Dirework needs KV.

### 2. Durable Objects

Free (SQLite-backed only): "100,000 / day" requests, "13,000 GB-s / day" duration, "5 GB
(total)" storage. Requests include "HTTP requests, RPC sessions, WebSocket messages, and
alarm invocations"; incoming WebSocket messages are billed at "a 20:1 ratio". Duration is
billed "in wall-clock time as long as the Object is active and not eligible for
hibernation", at a fixed 128 MB. Over a Free limit, "further operations of that type will
fail with an error" until 00:00 UTC.

#### 2a. Server-hosted Twitch bot (one DO holds the IRC WebSocket)

Shape: a `BotConnection` DO in the api worker opens `wss://irc-ws.chat.twitch.tv`, gets the
chat token from the existing `twitch-auth.ts` refresh path (already server side, so no
token leaves the server), and for each PRIVMSG calls the existing `handleMessage` / service
functions in-process with the D1 binding. No service-binding hop is needed. The dashboard
gets Start/Stop and a status chip; the `/bot/<token>` page becomes an optional fallback.

Arithmetic, always on: 86,400 s × 0.128 GB = **11,059 GB-s/day**, 85% of the 13,000 cap
(Cloudflare's own examples use 128 MB = 0.128 GB). That leaves ~1,940 GB-s (about 4.2 h of
one more awake object) for everything else, and if the cap is hit the bot stops until
00:00 UTC. Running only while live (8 h) is 3,686 GB-s/day, 28% of the cap. Requests stay
small: the pricing page bills incoming messages on server-side sockets and says "There is
no charge for outgoing WebSocket messages"; a keep-alive alarm every 10 minutes is 144
requests/day. Chat commands stop costing a Worker request each (no `bot.ingest` from the
browser) and the hourly `bot.getSession` calls go away.

Failure modes, from the DO docs:

- Outbound WebSockets never hibernate: "Hibernation is only supported when a Durable Object
  acts as a WebSocket server. Outgoing WebSockets do not hibernate." The object is billed
  for the whole connection.
- Eviction: "an open outbound WebSocket connection prevents eviction for up to 15 minutes"
  from its start. The docs do not say whether IRC traffic on that socket extends this, so
  the bot must expect eviction and keep an alarm that reconnects.
- Alarms: "a single alarm at a time"; retries only when the handler throws, "up to 6
  retries" from a 2 s backoff. The handler must catch and re-arm itself, or one long
  Twitch outage ends the loop.
- Deploys: "Deploying updated code causes the object to shut down" and WebSockets are
  terminated. Every deploy drops the bot; the alarm or the next dashboard action restores
  it.
- Reconnect storms: the browser backoff (5 s to 5 min with jitter, `bot-session.ts`), the
  60 s liveness watchdog and the `msg_duplicate` / NOTICE handling in `irc-client.ts` must
  move to the DO. `bot-session.ts` is already React-free, so this is a port, not a rewrite.
- One channel per instance, which matches one deploy per streamer.
- Duplicate relays (browser page left open plus the DO): `processed_chat_message` already
  makes the second one a no-op.

#### 2b. Push to overlays over hibernating inbound WebSockets

Shape: overlays open a WebSocket to an `OverlayHub` DO and receive state on change instead
of polling every 5 s. Hibernation applies here (the DO is the server) and while hibernated
"Billable Duration (GB-s) charges" do not accrue. Outgoing messages are free; each connect
costs one request.

Saves ~11,520 Worker requests per 8 h stream. Costs: one DO RPC from the api worker on
every task/timer write (to broadcast); reconnects after every deploy and network blip; and
a new phase-advance mechanism, because `maybeAdvanceOverdueTimer` runs inside the overlay
poll today, so without polls an alarm at `targetEndTime` must advance the phase. If 2a and
2b share one DO, the IRC socket keeps it awake and hibernation saves nothing. A silently
dropped socket would freeze an OBS overlay until reconnect; today's poll self-heals.

#### Prerequisites (checked in this repo)

- Alchemy `^0.94.0` (root `package.json` catalog) ships `DurableObjectNamespace` with
  `sqlite: true` and generates the `new_sqlite_classes` migration itself
  (`lib/cloudflare/worker-migration.js`), so no hand-written `migrations` block is needed.
  Renaming or deleting the class later still needs an explicit migration.
- Compatibility date `2026-04-24` (`packages/infra/deploy-config.ts`) is recent enough for
  SQLite-backed DOs and the WebSocket Hibernation API.
- `alchemy dev` must run the DO locally, and the e2e boot (`packages/e2e/src/boot-api.ts`)
  needs the binding too.

Verdict: worth a scoped experiment for 2a behind a flag, not a rewrite. 2b is a later,
separate decision; polling is cheap enough today.

### 3. Queues: no fit

Free: "10,000 operations/day included", "24 hours (non-configurable)" retention; a delivery
is about three operations. Dirework has no asynchronous pipeline: every chat command needs
its reply in the same request.

### 4. Cron Triggers: optional, low value

Free: 5 per account. The pages read today do not say whether a scheduled run counts toward
the 100k requests/day. A daily cron could run the done-task purge, dedupe pruning and token
scrub in one place. Each of those already runs at no request cost on a write path or at
deploy, and the tables stay bounded without a scheduler. A cron would be a second place to
keep in sync for no measurable saving. Use one only if a job appears with no natural write
path (for example, ending a timer left running for days).

### 5. Workers Analytics Engine and Workers Logs: not now

Analytics Engine Free: "100,000 included per day" data points written, "10,000 included per
day" read queries; not currently billed. Workers Logs Free: 3 days retention, 200,000 log
events/day. Telemetry today is one redacted JSON line per event into Workers Logs
(`telemetry.ts`) with a closed metric union. That is enough for one streamer. Analytics
Engine adds retention and SQL over metrics, but needs a binding, a read API token and a
dashboard nobody has asked for.

### 6. Smart Placement and D1 read replication: no

All api traffic starts on one machine: the streamer's (OBS overlays, bot page, dashboard).
Viewers never call the api; their chat reaches it through the streamer's bot page. So
there is no "far-away viewer" case. If the streamer is far from the D1 primary (say Europe
vs. eastern North America, ~80–100 ms per round trip), a poll costs 2–3 sequential round
trips, about 200–300 ms. That is invisible on a 5 s poll and small next to Twitch chat
latency for command replies.

- Smart Placement is "available on all Workers plans" but "requires consistent traffic to
  the Worker from multiple locations to make a placement decision"; a single-location app
  gives it nothing to decide.
- D1 read replication only works through the Sessions API on every query path; the pages
  read today do not say whether Free can enable it (not tested). Writes still go to the
  primary, and most chat commands write. Not worth the code.

### 7. Everything else

- **R2** (10 GB-month, 1M Class A, 10M Class B operations per month): no user uploads;
  fonts and images are static assets. No fit.
- **Workers AI** (10,000 Neurons/day): no feature needs it. No fit.
- **Browser Rendering** (10 minutes/day, 3 concurrent browsers): too short to host the
  bot page; the OG image is prerendered. No fit.
- **Images** (5,000 unique transformations/month): no user images. No fit.
- **Hyperdrive** (100,000 queries/day): for external Postgres/MySQL; we use D1. No fit.
- **Vectorize** (30M queried / 5M stored vector dimensions): no embeddings. No fit.
- **Workflows** (3,000 steps/day on Free, requests shared with Workers): no multi-step
  durable job exists. No fit.

## Decision

1. **Adopt nothing in code today.** D1 stays the single store. KV, Queues, Cron Triggers,
   Analytics Engine, Smart Placement, read replication, R2, Workers AI, Browser Rendering,
   Images, Hyperdrive, Vectorize and Workflows are not used.
2. **Prototype next: a DO-hosted Twitch bot (option 2a)** in the api worker, behind an
   off-by-default flag, with the browser bot page kept as the default until the experiment
   answers:
   - Does the outbound IRC socket survive past 15 minutes with chat traffic and no inbound
     requests, or does the alarm have to reconnect it?
   - Actual GB-s per day, live-only vs. always on (Cloudflare dashboard metrics).
   - Time to reconnect after a deploy.

   Run it live-only (Start/Stop from the dashboard), never 24/7, so the bot can't use 85%
   of the daily duration cap.
3. **When the experiment ships**, change these AGENTS.md lines in the same PR:
   - Project Overview: "Runs entirely on **Cloudflare Workers + D1** (free plan — no
     Durable Objects)." → "Runs on **Cloudflare Workers + D1**, plus one SQLite-backed
     Durable Object for the server-hosted bot (Workers Free plan; see
     `docs/decisions/0001-cloudflare-services.md`)."
   - Architecture, the "**Twitch bot = browser page.**" paragraph → describe the DO as the
     primary host and the `/bot/<token>` page as the fallback.
   - Code Review Rules: "No Workers cron triggers, Durable Objects, Queues, or other
     paid/metered bindings." → "No new bindings (cron triggers, Durable Objects, Queues,
     KV, …) without an ADR in `docs/decisions/` that states the daily request, row and
     GB-s cost against the Free limits. The bot DO must stay under half the 13,000
     GB-s/day cap."

## Consequences

- No change to cost, behaviour or deploys from this ADR.
- The review rule now rests on budget arithmetic, not a price list: a future PR can add a
  binding by showing its numbers the way this ADR does.
- If 2a ships, each deploy briefly drops the bot, and the daily DO duration cap becomes a
  third limit to watch next to Workers requests and D1 rows.

## Re-evaluate when

- Cloudflare changes the Free limits read on 2026-10-20: Durable Objects (100k
  requests/day, 13,000 GB-s/day), Workers (100k requests/day, 10 ms CPU), D1 (5M rows
  read / 100k rows written per day), KV (1,000 writes/day).
- Outbound WebSockets from a DO become hibernatable, or the 15-minute eviction rule
  changes. Either changes the 2a math.
- The docs state whether D1 read replication is on Free, or Dirework gains traffic that
  does not start on the streamer's machine.
- Overlay polling passes ~40% of the daily request budget (then reconsider 2b).
- A feature needs async retries (Queues), scheduled work with no write path (Cron), or user
  uploads (R2).

## Sources (all read 2026-10-20)

Prefix `https://developers.cloudflare.com`:

- Workers: `/workers/platform/limits/`, `/workers/configuration/cron-triggers/`,
  `/workers/configuration/placement/`, `/workers/observability/logs/workers-logs/`
- D1: `/d1/platform/pricing/`, `/d1/platform/limits/`, `/d1/best-practices/read-replication/`
- KV: `/kv/platform/limits/`, `/kv/concepts/how-kv-works/`
- Durable Objects: `/durable-objects/platform/pricing/`, `/durable-objects/platform/limits/`,
  `/durable-objects/concepts/durable-object-lifecycle/`,
  `/durable-objects/best-practices/websockets/`, `/durable-objects/api/alarms/`
- Queues `/queues/platform/pricing/`; Analytics Engine
  `/analytics/analytics-engine/pricing/`; R2 `/r2/pricing/`; Workers AI
  `/workers-ai/platform/pricing/`; Browser Rendering `/browser-rendering/pricing/`;
  Images `/images/pricing/`; Hyperdrive `/hyperdrive/platform/pricing/`; Vectorize
  `/vectorize/platform/pricing/`; Workflows `/workflows/reference/pricing/`
