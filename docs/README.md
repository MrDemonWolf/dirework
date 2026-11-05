# Documentation map

- [User guides](../apps/fumadocs/content/docs/index.mdx): setup, Twitch, OBS and commands.
- [Deployment and recovery](../apps/fumadocs/content/docs/deployment.mdx): deploy an instance,
  monitor it, understand quotas and recover data.
- [Production readiness](production-readiness.md): operator checklist, the Workers CPU
  baseline and evidence limits.
- [Cloudflare service decisions](decisions/0001-cloudflare-services.md): accepted architecture
  and conditions for future services.
- [Rendering and caching decisions](decisions/0002-rendering-and-caching.md): why Cache
  Components stay off on OpenNext, and which pages the back/forward cache keeps.
- [Client observability decisions](decisions/0003-client-observability.md): no Web Vitals in
  the app, no beacon on token pages, and client errors by name only.
- [Contributor guide](../CONTRIBUTING.md): local development, tests and pull requests.
- [Design system](../design-system/README.md): shared tokens and component specifications.
- [Security policy](../SECURITY.md): vulnerability reporting and operator responsibilities.

## Historical records

Completed plans and dated reviews live in `history/`. They document earlier decisions
and verification, and may describe older code or limits:

- [Cloudflare migration](history/MIGRATION.md) and [pre-migration audit](history/AUDIT-cloudflare-migration.md)
- [October 24 Cloudflare research](history/2026-10-24-cloudflare-services-research.md)
- [Logo prompt](history/logo.md)
