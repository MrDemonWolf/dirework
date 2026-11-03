# TODO

Owner to-dos and the product backlog, in plain language. Engineering work is tracked as pull
requests; this file holds what only the instance owner can do, plus ideas not yet turned into PRs.

## Owner actions

- [ ] Optional: turn on automatic Codex review for pull requests in the ChatGPT Codex settings
  (today every PR is reviewed by commenting `@codex review`).
- [ ] If your custom `!help` reply lists commands, add `!today` to it (Bot settings → Replies →
  Help).

The deploy secrets stay at repository level on this instance by the owner's choice; the
`production` environment still gates the deploy job.

## Backlog (not yet a PR)

- Keep the browser bot as the supported default. A browserless Durable Object bot is
  deferred unless the owner later needs it; see `docs/decisions/0001-cloudflare-services.md`.
