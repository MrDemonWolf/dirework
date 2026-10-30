# Codebase and website review — October 26, 2026

## Recommended direction

Keep Workers + D1 and the browser bot. Improve setup, monitoring and examples without
adding services. Free-tier compatibility is a design requirement; unlimited traffic
on the free plan is not a promise.

| Change | Benefit | Cost or limitation |
| --- | --- | --- |
| Guided Cloudflare deployment button | One obvious starting point and a short checklist | Still requires account, Twitch and secret configuration |
| Real app screenshots | Shows the dashboard, themes and bot before setup | Synthetic Wolf data; Twitch connection is simulated |
| Container support guide | Explains Docker, Portainer, Dokploy and Coolify accurately | No supported production image or Compose deployment exists |
| Validate uptime response bodies | Detects unhealthy readiness and broken version responses | External monitoring still needs operator configuration |
| Keep D1 authoritative | Preserves timer, task and token correctness | Busy instances must watch row-read quotas |

## Review scope and findings

This was a bounded source review across authentication, API authorization, task/timer
services, database access, infrastructure, bot runtime and public documentation. It
was not an exhaustive security audit or a production account inspection.

- No critical or high-severity issue was confirmed in this pass.
- Fixed the uptime workflow: HTTP success alone previously passed. It now requires
  exact HTTP 200 plus the expected readiness fields or a valid commit SHA. Regression
  tests execute the workflow shell against healthy and faulty responses.
- Documented a free-tier capacity risk: done-task aggregate counts read all retained
  completed rows on each poll. A stable 1,000 completed tasks over eight hours at a
  three-second cadence means about 5.76 million aggregate row reads, before other
  requests. The 50-item display limit does not bound aggregate reads. Actual production
  consumption was not measured. See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
- Deferred KV, queues and additional services: no measured need justifies the extra
  state, consistency rules or quota surface in this change.

## Deployment and support

The landing page links to the deployment guide's quick-start checklist. It does not
claim native one-click provisioning: this repository uses Alchemy to coordinate two
Workers, D1, bindings, state and post-deploy work. A native Deploy to Cloudflare flow
has not been implemented or verified.

The container guide provides platform-specific prerequisites and support boundaries.
It deliberately supplies no pretend production Compose file. The API depends on
Cloudflare runtime bindings; a portable backend or a carefully verified hybrid would
be required before claiming supported container deployment.

## Design research and visual review

Mobbin references were inspected for layout patterns, without copying their assets:

- [1Password developer hero](https://mobbin.com/sites/sections/84ae4767-03c2-40fd-a88b-d10071d797d8): clear primary action with a separate documentation path.
- [Snowflake getting-started screen](https://mobbin.com/screens/620c1b18-a8ab-453e-a652-1ad8aa1c2749): task-based entry points alongside reference navigation.

Official [Astro](https://docs.astro.build/en/getting-started/),
[Supabase](https://supabase.com/docs/guides/getting-started) and
[Cloudflare](https://developers.cloudflare.com/workers/get-started/) documentation
also informed the separation of deployment, local development and reference material.

The updated site preserves its existing typography, colors, interactive examples and
components. App examples use Wolf Streamer, WolfBot and fictional tasks. Bearer URLs
remain masked. The bot example uses mocked Twitch traffic and is labeled accordingly.

Screenshot sources and regeneration instructions are in
[`public/screenshots/README.md`](../../apps/fumadocs/public/screenshots/README.md).
Desktop and mobile browser checks cover the landing page, documentation home,
deployment guide, container guide and features page: HTTP status, heading hierarchy,
horizontal overflow, browser errors and the deployment link target.

## Remaining boundaries

Production OAuth, live Twitch replies, OBS behavior, production restore and account
quotas require operator verification. No deployment was performed during this review.
Container deployment and native one-click Cloudflare provisioning remain unsupported.
