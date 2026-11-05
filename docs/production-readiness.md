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
- [ ] After a representative stream, review both Workers' CPU time quantiles and any
  `exceededResources` outcome (error 1102), and compare them with the
  [CPU baseline](#cpu-baseline).
- [ ] Review deploy-secret placement, MFA, least-privilege access and effective branch
  protection/rulesets. Follow `TODO.md` and `SECURITY.md`; preserve Alchemy state credentials.
- [ ] Run `bun run recovery:check`, then practice restoring an actual private export into a
  separate test database. The synthetic local drill does not prove production Time Travel.
- [ ] Verify deployed telemetry settings. Redacted application logs remain useful; disabling
  tracing does not delete historical traces or rotate previously exposed private URLs.

## CPU baseline

Measured on 2026-11-05 with Cloudflare's GraphQL Analytics API (`workersInvocationsAdaptive`),
over the 7 days before. The window ran mostly Next 16.4.2–16.4.3 on `@opennextjs/cloudflare`
1.20.13–1.20.14. Next 16.4.5 with 1.20.16 went live on its last day.

| Worker | Requests | CPU p50 | p75 | p99 | p99.9 | `exceededResources` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `dirework-api` | 2,617 | 7.4 ms | 9.7 ms | 49 ms | 86 ms | 0 |
| `dirework` (web) | 416 | 19 ms | 249 ms | 581 ms | 1,306 ms | 0 |

Every request ended as `success` or `clientDisconnected`.

- **What the web numbers mean.** Workers Free
  [allows 10 ms of CPU](https://developers.cloudflare.com/workers/platform/limits/) per
  request. The web Worker serves about 60 requests a day, so many of them land on a cold
  isolate. OpenNext's worker imports the server bundle inside `fetch`
  (`await import("./server-functions/default/handler.mjs")`), so the first request in each
  isolate pays, as request CPU, for evaluating the whole bundle. The upload was 6,624 KiB
  (2,117 KiB gzip) in the 2026-11-04 audit build. That is what p75 to p99.9 (249 ms to
  1.3 s) point at. Even the median (19 ms) is about twice the Free limit. Every page renders
  per request ([ADR 0002](decisions/0002-rendering-and-caching.md)).
- **Why nothing has failed yet.** Cloudflare doesn't document it. Its limits page only allows
  "some built-in flexibility" for a Worker that "infrequently runs over" its CPU limit, and
  terminates one that "consistently hits the limit". An account where the 10 ms limit is
  enforced strictly would likely see error 1102 ("Worker exceeded resource limits") on such
  loads. That is what
  [opennextjs-cloudflare#1381](https://github.com/opennextjs/opennextjs-cloudflare/issues/1381)
  reports on Workers Free for Next 16.4.3 on adapter 1.20.13: 23–52% of requests failed in
  bursts, and none failed on Workers Paid. On an OBS overlay load, that error page would show
  on stream.
- **The api Worker.** Its median and p75 (7.4 and 9.7 ms) fit under 10 ms. The slowest
  quarter of its requests can go over (p99 49 ms, p99.9 86 ms).
- **Mitigation, without a paid plan.** Shrink the web Worker, so a cold isolate evaluates
  less:
  - Prerender the share card at build time, which takes `next/og` out of the Worker (−763 KiB
    gzip, −2,037 KiB uncompressed in a scratch build; planned).
  - Keep zod and the DB schema out of browser code (−64 KiB gzip on the Worker; PR #260).
  - Measure Worker startup in CI with `wrangler check startup` (PR #259).

  Change rendering only for a route with recorded 1102s, and only with a local reproduction
  (a workerd soak of a few hundred renders, as the #1381 report did). Take any paid-plan
  option to the owner first.
- **Re-check opennextjs-cloudflare#1381 on each `@opennextjs/cloudflare` 1.20.x bump.** It is
  still open on 2026-11-05, and 1.20.16 does not fix it.

### Re-measuring

You need an API token with **Account Analytics: Read**. Save the query below as
`worker-cpu.graphql` and run it once per Worker (`dirework`, `dirework-api`), with the window
in UTC. CPU quantiles come back in microseconds: divide by 1,000 for milliseconds. A `byStatus`
row with status `exceededResources` counts the requests Cloudflare cut off with error 1102.

```graphql
query WorkerCpu($accountTag: string, $scriptName: string, $since: string, $until: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      overall: workersInvocationsAdaptive(
        limit: 1
        filter: { scriptName: $scriptName, datetime_geq: $since, datetime_leq: $until }
      ) {
        dimensions { scriptName }
        sum { requests errors }
        quantiles { cpuTimeP50 cpuTimeP75 cpuTimeP99 cpuTimeP999 }
      }
      byStatus: workersInvocationsAdaptive(
        limit: 10
        filter: { scriptName: $scriptName, datetime_geq: $since, datetime_leq: $until }
      ) {
        dimensions { status }
        sum { requests }
      }
    }
  }
}
```

```sh
# CLOUDFLARE_ACCOUNT_ID, plus the Account Analytics: Read token in CLOUDFLARE_ANALYTICS_TOKEN.
jq -n --rawfile query worker-cpu.graphql \
  --arg accountTag "$CLOUDFLARE_ACCOUNT_ID" --arg scriptName dirework \
  --arg since 2026-10-29T00:00:00Z --arg until 2026-11-05T00:00:00Z \
  '{query: $query, variables: {accountTag: $accountTag, scriptName: $scriptName, since: $since, until: $until}}' |
  curl -s https://api.cloudflare.com/client/v4/graphql \
    -H "Authorization: Bearer $CLOUDFLARE_ANALYTICS_TOKEN" \
    -H "Content-Type: application/json" --data @-
```

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
