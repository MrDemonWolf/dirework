# UI/UX Review: DireWork bot console

Historical review of the October 24, 2026 changes. Later UI changes require a fresh review.

**Reviewed:** 2026-10-24 · **Input:** implementation code and Chromium screenshots at 400×200, 390×844 and 1100×760 · **Method:** NN/g heuristic evaluation + guideline review

## Executive summary

- Keep the browser bot architecture. This change only presents existing session state and activity.
- Use the existing Focus Console navy, cerulean and semantic status tokens, pinned to dark locally.
- At 400×200, prioritize connection status at the top left, identity, uptime, counters and a scrollable log. Taller viewports add context and framed activity.
- No severity 3–4 issue found in the checked scope. Physical OBS and real Twitch behavior still require verification.

**Findings:** 0 catastrophic · 0 major · 0 remaining minor · 0 remaining cosmetic in code review

## Findings

### Severity 2, resolved — Status and supporting detail had equal visual weight

- **What:** The previous console used flat, nearly identical rows for identity, counters and activity. The redesign keeps connection status first, separates the activity panel on taller viewports, and distinguishes numerical counters from identity.
- **Where:** Bot console header, statistics and activity feed.
- **Guideline:** Visibility of system status and minimalist presentation.
- **Evidence:** [Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) supports preserving useful information while reducing competing presentation.
- **Fix:**
  - [x] Reuse StatusChip with the existing connection labels and semantic tones.
  - [x] Preserve compact source readability without hiding identity or counters.

### Severity 1, resolved — Recovery instructions lacked a direct route to settings

- **What:** Invalid, reset and expired-login states explained recovery, but did not link to the existing settings page.
- **Where:** Terminal notices.
- **Guideline:** Help users recover using clear, actionable information.
- **Evidence:** [How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/) supports concise, objective instructions and meaningful links.
- **Fix:**
  - [x] Retain exact terminal headings and specific recovery instructions.
  - [x] Add the existing settings route without the source token and with prefetch disabled.

## Unverified (needs a different input to check)

- Physical OBS browser-source behavior, Twitch connection stability, Safari, screen readers and physical touch devices need separate verification.
- Color tokens are reused; exhaustive contrast measurement across every rendered state remains unverified.

## What's working well

- Session lifecycle, counters, twenty-event activity cap, scroll pinning, token handling and request cadence are unchanged.
- Status announcements, terminal alerts, focusable scrolling and automatic crash recovery remain.
- The bot layout imports no heading font. Restart uses the shared Button primitive.
- No dependency, polling, secret display or speculative reconnect control was added.

## Quick wins

- [x] Pin the existing dark design tokens for an unattended console.
- [x] Keep the connection state readable at the top left.
- [x] Disable dashboard link prefetch to avoid extra requests from the unattended page.
- [x] Review compact, mobile and desktop screenshots; keep status visible without horizontal overflow.
- [x] Allow long channel and bot names to wrap on tall mobile viewports.

## Mobbin references

Actual inline images were inspected, rather than relying on metadata. These broad developer-tool references informed grouping and the restrained navy panel treatment; no reference assets were copied:

- [Shopify developer section](https://mobbin.com/sites/sections/848358e0-f42c-4880-84ae-e972247e8583): discrete task groups with short labels.
- [1Password developer section](https://mobbin.com/sites/sections/98769065-437c-4aec-a6f9-ba422a7f6b59): navy surface with clear primary and supporting content.

## Verification

- OpenNext production Worker build, web/e2e typechecks, lint and all 344 web unit tests passed.
- All 12 browser tests passed, including five new bot-console tests with mocked Twitch/API responses.
- Checked command/reply activity, reconnect after a simulated interruption, revocation after a live connection, invalid links, expired login and the unconfigured state. No messages were sent to real Twitch.
- Reviewed generated compact-source, mobile and desktop screenshots. These were local evidence, not production proof; generated test output is not retained as a durable repository artifact.
- No new service, polling cadence, dependency, font preload or dashboard prefetch was introduced. Existing session logic is unchanged.

The first error-state test run hit Next.js's separate route-announcer alert; scoping assertions to the notice heading resolved the test ambiguity. An initially unauthorized URL correctly renders the invalid-link state; revocation is separately tested after a live connection.

Not deployed. Actual OBS, Twitch OAuth/refresh, screen-reader behavior and physical devices remain unverified.
