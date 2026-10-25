# Production readiness

This is an operator checklist, not a production certification. DireWork supports one
streamer per instance on Workers + D1, within the Cloudflare account's free quotas.
No paid service is required. See [service decisions](decisions/0001-cloudflare-services.md)
and the [deployment guide](../apps/fumadocs/content/docs/deployment.mdx).

## Before relying on a deployment

- [ ] Claim the instance with the intended Twitch owner immediately after first deploy.
- [ ] Verify owner sign-in, bot connection, a real chat task command, a complete timer
  transition in OBS, and recovery after a network interruption.
- [ ] Keep exactly one bot page or OBS dock running; a closed page stops the bot.
- [ ] Confirm deployment smoke checks pass and `/api/version` reports the expected commit.
- [ ] Configure the existing Uptime workflow or an external monitor and test its notification
  destination. The Uptime workflow uses `UPTIME_API_URL` and `UPTIME_WEB_URL` repository
  variables; unset variables leave it inactive.
- [ ] Review account-wide Workers requests and D1 rows before and after a representative
  stream. Free quotas are shared with other applications in the account.
- [ ] Review deploy-secret placement, MFA, least-privilege access and effective branch
  protection/rulesets. Follow `TODO.md` and `SECURITY.md`; preserve Alchemy state credentials.
- [ ] Run `bun run recovery:check`, then practice restoring an actual private export into a
  separate test database. The synthetic local drill does not prove production Time Travel.
- [ ] Verify deployed telemetry settings. Redacted application logs remain useful; disabling
  tracing does not delete historical traces or rotate previously exposed private URLs.

## Evidence boundaries

Local integration checks on October 25, 2026 passed: dependency audit, lint, typechecks,
coverage across eight test packages, docs and Worker builds, free-tier bundle budgets,
runtime smoke checks, synthetic database recovery and all 79 desktop/mobile browser tests.
This is a dated verification snapshot, not a production certification. Rerun the shared
CI checks for later changes.

Production Twitch/OBS behavior, notification delivery, account quotas and recovery of
real credentials require operator verification. Deployment responses and local tests
alone do not prove them. Private exports contain bot credentials, sessions and bearer
URLs; keep them out of repositories and public build artifacts, and review authorization
state after a restore.
