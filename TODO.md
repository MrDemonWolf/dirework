# TODO

Owner to-dos and the product backlog, in plain language. Engineering work is tracked as pull
requests; this file holds what only the instance owner can do, plus ideas not yet turned into PRs.

## Owner actions

- [ ] Optional: turn on automatic Codex review for pull requests in the ChatGPT Codex settings
  (today every PR is reviewed by commenting `@codex review`).
- [ ] If your custom `!help` reply lists commands, add `!today` to it (Bot settings → Replies →
  Help).
- [ ] Optional: let Cloudflare cache the docs site's static files for a year. GitHub Pages sends
  every file, content-hashed `/_next/static/*` included, with `max-age=600`, so a reader who
  comes back after 10 minutes re-checks about 17 files on `/docs`. Nothing changes in the repo;
  it is three settings in the `mrdemonwolf.dev` Cloudflare zone (free plan, no Worker):
  1. **DNS → Records**: on `dirework` (CNAME `mrdemonwolf.github.io`), set Proxy status to
     **Proxied**.
  2. **SSL/TLS** for this host: **Full**. Not Full (strict): GitHub may stop renewing its
     certificate once the host is proxied, and strict would then take the site down. Never
     Flexible: GitHub's HTTPS redirect would loop. If the zone uses Full (strict) for other
     hosts, keep it and add a Configuration Rule instead (**Rules → Configuration Rules**:
     Hostname equals `dirework.mrdemonwolf.dev`, then SSL: Full).
  3. **Caching → Cache Rules → Create rule** "Docs static files":
     - When: Hostname equals `dirework.mrdemonwolf.dev` and URI Path starts with
       `/_next/static/`. As an expression:
       `(http.host eq "dirework.mrdemonwolf.dev" and starts_with(http.request.uri.path, "/_next/static/"))`
     - Then: **Eligible for cache**; Edge TTL **Ignore cache-control header**, 1 year; Browser
       TTL **Override origin**, 1 year.

  Pages and the search index (`/api/search`) keep GitHub's 10 minutes. To check it (the chunk
  name is read from the live page, so it is always current):

  ```bash
  asset=$(curl -s https://dirework.mrdemonwolf.dev/docs | grep -o '/_next/static/chunks/[^"]*\.js' | head -n 1)
  curl -sI "https://dirework.mrdemonwolf.dev$asset" | grep -iE '^(cache-control|cf-cache-status):'
  # cache-control: max-age=31536000, and cf-cache-status: HIT (MISS the first time)
  curl -sI https://dirework.mrdemonwolf.dev/docs | grep -iE '^(cache-control|cf-cache-status):'
  # cache-control: max-age=600, and cf-cache-status: DYNAMIC (pages aren't cached at the edge)
  ```

  To undo it, set the record back to **DNS only**.

The deploy secrets stay at repository level on this instance by the owner's choice; the
`production` environment still gates the deploy job.

## Backlog (not yet a PR)

- Keep the browser bot as the supported default. A browserless Durable Object bot is
  deferred unless the owner later needs it; see `docs/decisions/0001-cloudflare-services.md`.
