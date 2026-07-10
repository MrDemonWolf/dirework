# Dirework Design System

Single source of truth for Dirework's visual language across the web app, the docs site, and the OBS overlays.

## Layout

```text
design-system/
  tokens.json          # canonical token source — edit this
  scripts/generate.ts  # bun script that emits per-platform outputs
  README.md            # this file
  components/          # markdown catalog (one .md per shared UI primitive)
```

## Generated outputs

`bun run tokens` (from repo root) regenerates one file. It is committed so consumers never need to run the generator themselves.

| Platform | Output | Consumed by |
|---|---|---|
| Docs widgets | `apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts` | Typed `OVERLAY_THEMES` map powering the landing-page theme gallery |

Shared overlay geometry (squircle path/perimeter, `SQUIRCLE_RADIUS`, MM:SS clock formatting) lives in the pure workspace package `packages/overlay-kit` (`@dirework/overlay-kit`), used by both the real overlays (apps/web) and the docs mocks. A unit test (`apps/web/src/lib/__tests__/theme-palette-sync.test.ts`) asserts `tokens.json` stays in sync with the web app's theme presets and with `SQUIRCLE_RADIUS`.

## Token namespaces

| Namespace | Purpose | Examples |
|---|---|---|
| `color.brand.{50…900}` | Primary brand scale (Cerulean) | `brand500 = #00ACED` |
| `color.brandDark` | Brand overrides for dark mode | `brand500 = #29B6F0` |
| `color.semantic` | Status colors | `success`, `warning`, `error`, `info` |
| `color.phase` | Pomodoro phase accents | `work`, `break`, `longBreak`, `paused` |
| `color.surface.{light,dark}` | Backgrounds, elevation, dividers | `base`, `surface`, `elev`, `hairline` |
| `color.text.{light,dark}` | Text hierarchy | `primary`, `secondary`, `muted` |
| `color.partner` | Third-party brand colors | `twitch`, `discord`, `obs` |
| `font.family` | Typeface stacks | `display` (Montserrat), `sans` (IBM Plex Sans), `mono` |
| `font.size` | Type scale (px) | `xs=12 … 6xl=60` |
| `font.weight` | Numeric weights | `regular=400 … extrabold=800` |
| `space` | Spacing scale (px) | `1=4 … 11=80` |
| `radius` | Corner radii | `xs=6 … 2xl=24`, `pill=9999` |
| `motion.duration` | Animation durations (ms) | `fast=150`, `base=220`, `slow=320` |
| `motion.easing` | Cubic-beziers | `standard`, `emphasized` |
| `shadow` | Drop shadows incl. brand glow | `xs … lg`, `glow` |
| `overlay.themes` | OBS overlay theme swatches | 6 presets `{ bg, accent, text, username }` |

## Brand primary

Dirework's primary brand color is **Cerulean `#00ACED`** — a bright, focused blue used sparingly as the accent (buttons, links, active rings). Twitch purple (`#9146FF`, kept under `color.partner.twitch`) is reserved for Twitch sign-in/connect actions only. Dark mode lightens the brand to `#29B6F0` for contrast on near-black surfaces. The headings typeface is **Montserrat**; body copy is **IBM Plex Sans**; labels and numerals use **IBM Plex Mono** — matching the web app.

## Overlay themes

`overlay.themes` mirrors the 6 presets shipped in `apps/web/src/lib/theme-presets.ts`. The full nested style objects live in the app; this file holds only the four swatch colors (`bg`, `accent`, `text`, `username`) each theme exposes, which is all the docs gallery needs. When a preset's preview colors change, update both — `apps/web/src/lib/__tests__/theme-palette-sync.test.ts` fails CI if they drift.

## Change process

1. Edit `design-system/tokens.json`.
2. Run `bun run tokens` from the repo root.
3. Commit `tokens.json` **and** all generated files in the same commit. CI verifies they are in sync (`bun run tokens && git diff --exit-code`).
4. If the change is breaking (rename, removed key, value drift), bump `meta.version` and call it out in the PR description.

## Component catalog

`components/` documents the shared UI primitives used on the marketing/docs surfaces (the `dw-*` utility classes defined in `apps/fumadocs/src/app/global.css`). Each entry covers purpose, tokens used, accessibility notes, and a usage snippet.
