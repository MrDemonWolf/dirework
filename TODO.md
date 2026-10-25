# TODO

Owner to-dos and the product backlog, in plain language. Engineering work is tracked as pull
requests; this file holds what only the instance owner can do, plus ideas not yet turned into PRs.

## Owner actions

- [ ] **Move the 7 deploy secrets into the `production` GitHub environment** and delete the
  repository-level copies, so only the deploy job can read them:

  ```bash
  gh secret set NAME -e production -R MrDemonWolf/dirework   # paste the value
  gh secret delete NAME -R MrDemonWolf/dirework
  ```

  - `ALCHEMY_PASSWORD` and `ALCHEMY_STATE_TOKEN`: move only if you have the values saved.
    **Never regenerate them** — the password unlocks Alchemy's deploy state and the token
    authenticates the shared state store. If they aren't saved, leave these two at repository
    level (it works; it's just less tidy).
  - `PROXY_SECRET`, `BETTER_AUTH_SECRET`: safe to regenerate (`openssl rand -base64 32`); a new
    auth secret signs you out once.
  - `CLOUDFLARE_API_TOKEN`: create a new token in the Cloudflare dashboard if the old value isn't
    saved; revoke the old one after the next deploy succeeds.
  - `TWITCH_CLIENT_ID` (visible in the Twitch console) and `TWITCH_CLIENT_SECRET` (shown only
    when generated — "New Secret" invalidates the old one, so set the new value right away; if
    the bot's token refresh then fails, reconnect it from the Bot page).
- [ ] Turn on automatic Codex review for pull requests in the ChatGPT Codex settings (today every
  PR is reviewed by commenting `@codex review`).
- [ ] If your custom `!help` reply lists commands, add `!today` to it (Bot settings → Task
  commands → Help).

## Backlog (not yet a PR)

- Keep the browser bot as the supported default. A browserless Durable Object bot is
  deferred unless the owner later needs it; see `docs/decisions/0001-cloudflare-services.md`.
- Theme Center: preview toggle, backdrops, grouped sections and per-section resets.
- Viewer landing page and an owner-first `/setup`.
