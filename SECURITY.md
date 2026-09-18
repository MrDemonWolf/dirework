# Security Policy

## Supported versions

Security fixes are applied to the latest commit on `main`. Older releases, forks, and private deployments are maintained by their operators and should be updated before reporting a problem as unresolved.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include secrets, bearer URLs, tokens, personal data, or exploit details in a public discussion.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/mrdemonwolf/dirework/security/advisories/new). Include:

- the affected route, component, or commit;
- impact and realistic attack conditions;
- minimal reproduction steps or a proof of concept;
- any suggested mitigation; and
- a safe way to contact you for follow-up.

The maintainers will acknowledge the report, reproduce and assess it, coordinate a fix, and publish details after affected operators have had a reasonable opportunity to update. Please avoid accessing data that is not yours or disrupting a live instance while testing.

## Operator responsibilities

Each Dirework deployment is independently operated. Production operators should:

- protect the Cloudflare and GitHub accounts with MFA and least-privilege access;
- use unique, randomly generated production secrets of at least 32 characters;
- keep `BETTER_AUTH_URL` and `CORS_ORIGIN` identical and HTTPS-only;
- enable branch protection for `main` and require the Verify and CodeQL workflows before merging;
- enable GitHub secret scanning and push protection, and review any bypass alert;
- treat bot and overlay URLs as bearer credentials, never publish them, and regenerate them after suspected disclosure;
- keep exactly one bot console active to avoid duplicate command processing;
- review Cloudflare logs and configure retention or backups appropriate to their users; and
- apply dependency and Dirework updates promptly.

If a credential or bearer URL leaks, rotate it before investigating further. Rotate the Cloudflare API token and Twitch client secret at their providers, replace deployment secrets in GitHub, regenerate bot and overlay tokens in Dirework, and redeploy. Rotating `BETTER_AUTH_SECRET` invalidates existing sessions.

## Pinned dependency remediations

The root dependency constraints keep transitive build tooling on patched releases when
parent packages still allow vulnerable versions. The infra test suite verifies that
`brace-expansion` resolves only to its fixed v2 and v5 lines and retains bounded output.
Remove a pin once every parent dependency resolves an equivalent or newer fixed release.

## Development-tool advisory residuals

A raw `bun audit` currently also reports `GHSA-67mh-4wv8-2f99` through Drizzle Kit
and `GHSA-g7r4-m6w7-qqqr` through the documentation compiler. Both advisories concern
esbuild development-server behavior; those dependency paths are build-time only and are
not shipped in either production Worker. Never expose a local development server to an
untrusted network. Keep tracking upstream Drizzle Kit and Fumadocs releases and remove
this accepted residual as soon as their dependency graphs carry fixed esbuild versions.
The enforced audit still fails on every unmitigated high-severity advisory.
