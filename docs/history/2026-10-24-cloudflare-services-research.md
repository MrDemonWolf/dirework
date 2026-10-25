# Cloudflare services research (October 24, 2026)

Research date: October 24, 2026. Research and planning only; no deployment or application changes.

Historical research snapshot, not the current architecture decision or operating guide.
Use [ADR 0001](../decisions/0001-cloudflare-services.md) for service decisions and
[Production readiness](../production-readiness.md) for operator checks. Polling estimates
and dependency details below describe the checkout reviewed at that time and may be outdated.
The owner prefers retaining the browser bot. A browserless migration is deferred; the
browser console redesign is tracked in [its UI review](2026-10-24-bot-console-ui-review.md).

## ADHD summary

**Keep Workers + D1. Make recovery and operations dependable before adding storage.**

Dirework's single-owner model is a good fit for its current architecture. More Cloudflare products will help only where they solve a specific operational or product problem.

1. **Do first:** verify monitoring, review trace privacy, and prove database recovery.
2. **Best small architecture experiment:** an HTTP Service Binding for web-to-API calls.
3. **Best optional storage addition:** private R2 exports, if seven days of recovery history is insufficient.
4. **Best future product improvement:** one Durable Object running the bot without a browser page.
5. **Skip KV for now:** live timer/task state and token revocation need stronger consistency.

## What already exists

Inspected the actual infrastructure, security policy, deployment documentation, CI workflows, polling constants, and relevant services. Three research agents separately assessed storage, reliability, and realtime/background processing using current official documentation.

- Two Workers and one D1 database, provisioned through Alchemy.
- Separate rate-limit buckets for authentication, bot traffic, token checks, and overlays.
- Worker secrets, signed proxy identity, owner-only mutation authorization, and token-gated public routes.
- Redacted structured logs, invocation logs disabled, and 5% trace sampling.
- Readiness probes, post-deploy version checks, real workerd browser tests, and documented code rollback.
- Indexed task reads, atomic mutations, lazy retention cleanup, and local countdown rendering.
- OpenNext read-only Static Assets caching. No new cache backend is needed for these assets.

These are code/configuration findings, not proof that live configuration or physical OBS behavior is correct.

## Service decisions and tradeoffs

| Service / change | Recommendation | Pros | Cons / limits |
| --- | --- | --- | --- |
| D1 Time Travel + recovery drill | First priority | Existing recovery mechanism; no new service; proves owner data can be recovered | Restore rewinds newer data and authorization state; needs a disposable database drill |
| Workers Logs/Traces + monitoring | Verify and tighten | Existing telemetry can help diagnose failures and usage | Configured telemetry is not an alerting system; traces can contain sensitive URLs |
| HTTP Service Bindings | Small prototype next | Internal web-to-API transport; keeps two existing Workers; potential latency benefit | Must preserve OAuth cookies, redirects, streaming, identity and local development; Free quota savings need verification |
| Private R2 exports | Optional after recovery drill | Longer retention and portable SQL exports | Extra permissions, retention policy and job; same-account copies do not protect against full account compromise |
| Durable Object browserless bot | Separate later prototype | Bot can run while OBS/browser is closed; one connection owner per instance | Outbound Twitch socket cannot hibernate; reconnect, refresh, revocation and quota handling remain substantial work |
| KV | Skip for live application state | Good for read-heavy data where delayed propagation is acceptable | Staleness, extra quota, dual writes and invalidation; poor fit for live state or authorization |
| Cron Triggers | Only for a concrete timed maintenance requirement | Cleanup can run when nobody uses the app | Existing lazy cleanup is sufficient unless a wall-clock deletion requirement exists; not precise timer scheduling |
| DO overlay WebSockets | Defer until measured need | Faster updates; can reduce polling | Hub, fanout, reconnect/resync and revocation complexity for one streamer |
| Queues / Workflows | Defer | Useful for future retryable exports or multi-step jobs | No present job requires them; asynchronous chat execution adds ordering/idempotency complexity |
| Secrets Store | Skip now | Useful for shared secrets across a larger fleet | Current Worker secrets suit two Workers; adds another integration and is currently beta |

### Why KV is not the next step

KV changes can remain stale for **60 seconds or more**, and KV does not provide atomic transactions. That is incompatible with the current expectation that a token reset immediately invalidates the old URL and that timer/task mutations become promptly visible. D1 already owns these invariants. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

The Free allowance is 100,000 key reads and 1,000 writes/day; writes to one key are limited to once per second. KV also does not eliminate incoming Worker requests. It would trade some database reads for another quota and synchronization work. [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/)

Published, immutable theme versions or public notices could use KV later if delayed propagation becomes acceptable. Current theme presets already ship in code, so this is not a present requirement.

### Recovery and R2

D1 Time Travel is always on, with **7 days on Free and 30 days on Paid**. Existing deployment docs already cover exports and recovery; the missing evidence is a completed recovery drill. [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

If longer retention is needed, use a private R2 bucket for SQL exports with a defined expiry policy. R2 Standard includes 10 GB-month storage, 1 million Class A operations and 10 million Class B operations monthly; account-wide existing usage matters. Do not assume free allowances mean a hard spending cap. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Backups contain sensitive bot/session state. Use least-privilege export credentials, never public buckets or repository artifacts, and review token/session validity after a restore. An independent encrypted copy is needed if recovery from total Cloudflare account loss is a requirement.

### Service Binding prototype

Bind the web Worker to the API Worker and use its HTTP `fetch` interface in existing server-side transport paths. Keep browser-facing same-origin route handlers and public overlay/bot API routes. Do not introduce a second RPC architecture. [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)

Scope: Alchemy bindings, runtime environment types, `auth-proxy.ts`, `server-session.ts`, and affected transport/runtime tests. Preserve manual redirects, Set-Cookie, streaming, timeouts, HMAC client identity, JSON/CORS defenses, and the standalone Next development fallback.

Cloudflare explicitly documents aggregated request billing for Service Bindings under Standard pricing. **Do not promise that this halves Free-plan quota usage without checking actual Free accounting.** Treat the initial benefit as internal transport and measure before/after. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Browserless bot prototype

SQLite-backed Durable Objects are available on Free. The meaningful benefit is removing the requirement to keep a browser page open, not turning Dirework into a multi-user platform. Keep one bot per deployment and reuse existing services, deduplication, throttling and refresh rules. [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

Outbound Twitch WebSockets **cannot hibernate**. At the documented 128 MB allocation, an object active for 24 hours uses approximately `0.125 GB × 86,400 seconds = 10,800 GB-s`, around 83% of the 13,000 GB-s/day Free allowance. Eight hours uses about 3,600 GB-s. These are estimates, shared with other DO use in the account, including infrastructure state storage. [WebSocket limitations](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)

A prototype must prove reconnect after eviction/deploy, token refresh/revocation, one active connection, command ordering, duplicate suppression, reply throttling and operation near quota limits. This is a product feature with operational work, not a small reliability toggle.

## Free-tier headroom

Workers Free allows 100,000 requests/day across the account. D1 Free allows 5 million rows read and 100,000 rows written/day. Unrelated projects share the relevant account allowances. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

Estimates from `apps/web/src/lib/poll-intervals.ts`, excluding page loads, bot commands, retries and other apps:

| Scenario | Approximate Worker requests |
| --- | ---: |
| Two overlays for 8 hours | 19,200 |
| Two overlays for 24 hours | 57,600 |
| Two overlays + continuously active dashboard for 8 hours | Up to 67,200 |
| Two overlays + idle visible dashboard for 24 hours | Up to 80,640 |

Dashboard estimates count the existing public web-to-API hop twice and assume separate timer/task calls. tRPC batching can reduce totals. Measure one representative stream before optimizing.

Cloudflare currently lists Workers Paid at a $5/month subscription plus applicable usage. Keep Free as the default; reconsider a paid account only if measured workload needs it, rather than building multiple services merely to avoid that subscription. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Production plan

### Phase 1: operational proof, no new application service

- [ ] Verify actual production configuration and the open owner actions in `TODO.md`, including GitHub environment secrets and required branch checks. Never regenerate Alchemy state credentials casually.
- [ ] Review trace privacy: `AGENTS.md` acknowledges root-span `url.full` can retain bot/overlay bearer URLs. Restrict telemetry access; verify supported redaction or disable affected tracing if needed. Preserve safe application logs.
- [ ] Confirm monitoring of `/ready`, usage/error notifications and a tested notification destination. A five-minute readiness probe adds about 288 API requests/day plus D1 reads; choose cadence deliberately.
- [ ] Export and restore into an isolated database; verify schema, counts, config and authorization behavior. Document recovery time, acceptable data loss and post-restore credential actions.
- [ ] Verify deployed owner login, bot connect/refresh/reset, and a real OBS/chat stream session, including a network interruption. Record request and D1 usage.

### Phase 2: one focused transport experiment

- [ ] Prototype the HTTP Service Binding with existing Alchemy/OpenNext versions.
- [ ] Run proxy/session tests and real workerd browser tests, including OAuth redirect/cookie behavior and local development fallback.
- [ ] Compare latency and account request accounting. Keep only if the benefit justifies the adapter.

### Phase 3: optional features with explicit requirements

- [ ] Add retained R2 exports only after choosing retention, export method, credentials and restore procedure. Start with a manual/operator workflow before a new automation service.
- [ ] Prototype the browserless DO bot separately if closing the browser is a desired feature; measure duration and restart behavior.
- [ ] Add Cron only if cleanup must happen without user activity; keep accurate countdowns based on existing timestamps and overdue catch-up logic.

The current `AGENTS.md` code-review rules prohibit new Cron, DO and Queue bindings and require Free-tier operation. Research is appropriate; implementation of these optional ideas must include a deliberate policy update, rather than silently bypassing that rule. Preserve the single-owner architecture and Alchemy workflow.

Before any Access changes, inspect current applications, policies and memberships. Keep bearer-token OBS/bot routes and Twitch callbacks compatible; this report makes no claim about current live Access configuration.

## Evidence boundaries

Reviewed local code/configuration and current official docs; three agents contributed independent research. No application code, deployment settings, roles, secrets or live data changed. Existing edits in `AGENTS.md` and `packages/infra/alchemy.run.ts` were preserved.

No tests were run because this change is a research document. Production account settings, alert delivery, database restoration and actual OBS/Twitch behavior remain unverified. Product limits and pricing should be rechecked at implementation time.

The requested local `remove-ai-marks` service health check failed because the service was unavailable; no cleaning was performed.
