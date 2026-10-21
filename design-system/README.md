# Dirework Design System

Reference for Dirework's visual language across the web app, the docs site, and the OBS overlays. `tokens.json` is the source of truth: it generates the color, radius, type, tracking, motion, layout and z-index CSS for **both** the web app and the docs site, the docs theme gallery module, and holds the overlay theme swatches and squircle radius. Live values won: the palette in `tokens.json` is exactly what the app shipped before the CSS was generated.

## Layout

```text
design-system/
  tokens.json          # the tokens — edit this
  scripts/render.ts    # pure renderers: tokens → CSS / TS strings (imported by tests)
  scripts/generate.ts  # bun script: reads tokens.json, writes the outputs
  README.md            # this file
  components/          # one spec per component (README = index + page map)
```

## Generated outputs

`bun run tokens` (from repo root) regenerates three files. They are committed so consumers never need to run the generator themselves.

| Output | Imported by | Holds |
|---|---|---|
| `apps/web/src/tokens.generated.css` | `apps/web/src/index.css` | Palette (`:root` + `.dark`), `--radius` and the radius scale, phase/partner/z variables, the Tailwind theme registration and the extra type/tracking/motion/layout tokens |
| `apps/fumadocs/src/app/tokens.generated.css` | `apps/fumadocs/src/app/global.css` | The same, minus the radius (see below), plus an OS-preference dark block for before the theme class is set |
| `apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts` | Docs landing page | Typed `OVERLAY_THEMES` map powering the theme gallery |

Each CSS file has four parts: plain variables on `:root` / `.dark`, an `@theme inline` block that registers the palette with Tailwind (`--color-<key>: var(--<key>)`, so `bg-background` follows the theme class; `--color-twitch` is a literal because it never flips), and an `@theme static` block for tokens Tailwind doesn't ship (`--text-2xs`, `--tracking-label`, `--ease-console`, `--animate-console-rise`, `--container-content`, `--spacing-header`, and the `console-rise` keyframes).

**Docs twin, no radius.** fumadocs-ui ships its components' class lists to the docs app's Tailwind, so `rounded-lg` & co. are compiled against the docs theme. Overriding the radius scale there would restyle every fumadocs component, so the docs file leaves Tailwind's default radii alone.

**Fonts stay hand-written** in `index.css` and `global.css`: they wrap the `next/font` variables, and the two apps use different variable names and fallback stacks. `font.family` in `tokens.json` lists the typeface names only.

`global.css` maps the generated palette onto the names the docs surfaces read (`--color-fd-*`, `--bg-*`, `--txt-*`, `--color-twitch`, `--color-live`) and keeps the docs-only values by hand (`--brand-*` literals, chip/chat text colors, shiki, `--color-fd-overlay`, `--dw-radius-control`).

Shared overlay geometry (squircle path/perimeter, `SQUIRCLE_RADIUS`, MM:SS clock formatting) lives in the pure workspace package `packages/overlay-kit` (`@dirework/overlay-kit`), used by both the real overlays (apps/web) and the docs mocks.

## Token namespaces

| Namespace | Emits | Examples |
|---|---|---|
| `color.scheme.{light,dark}` | `--<key>` on `:root` / `.dark`, `--color-<key>` in Tailwind | `background`, `primary`, `success`, `border`, `hairline`, `cornflower`, `chart-1…5`, `sidebar-*`. Values are oklch; `"{cornflower}"` aliases another key (`var(--cornflower)`). Both schemes must have the same keys. |
| `color.phase` | `--phase-{work,break,long-break,paused}` | `work = #34C759`, `paused = #FF9F0A` |
| `color.console` | `--color-console-<key>` (web only, literal) | Bot console (`/bot/<token>`), always dark: `base`, `line`, `edge`, `muted`, `soft`, `fg`, `bright` (Tailwind zinc 950…100) |
| `color.partner` | `--twitch`, `--twitch-hover`, `--color-twitch(-hover)` | `twitch = #9146FF`, `twitchHover = #7C3AE6`; `discord`, `obs` are reference only |
| `color.brand`, `color.brandDark`, `color.semantic` | nothing | Hex palette for places that can't read CSS variables (OG images, docs widgets, design files). Not generated. |
| `font.family` | nothing | Typeface names (Montserrat, IBM Plex Sans, IBM Plex Mono) |
| `font.size` (px) | `--text-<step>` for steps Tailwind lacks | `3xs = 10`, `2xs = 11`; `xs…9xl` are Tailwind's defaults, listed for reference (a test checks them against `tailwindcss/theme.css`) |
| `font.lineHeight` (px) | `--text-<step>--line-height` | none yet: `2xs`/`3xs` set only the font size and inherit the line height |
| `tracking` | `--tracking-<name>` | `chip .08em`, `label .12em`, `eyebrow .18em`, `display .2em`, `marquee .3em` |
| `radius` (px) | `--radius` (= `lg`) and `--radius-<step>: calc(var(--radius) ± Npx)` | `xs 4`, `sm 8 … 4xl 28`; web only |
| `motion.easing` | `--ease-<name>` | `console = cubic-bezier(0.22, 1, 0.36, 1)` |
| `motion.animation` | `--animate-<name>` + its `@keyframes` | `console-rise` (450ms), `console-rise-fast` (200ms) |
| `layout.container` / `layout.spacing` | `--container-<name>` / `--spacing-<name>` | `content 72rem`, `editor 380px`, `header 3.5rem` |
| `z` | `--z-<name>` | `saveBar 40`, `header 50`, `skipLink 60` |
| `overlay` | overlay-themes.generated.ts | 6 presets `{ bg, accent, text, username }`, `squircleRadius` |

## Palette rationale

Focus Console is dark-first: a MrDemonWolf midnight navy base (the `#091533` family), cool-white text, Cerulean `#00ACED` as the brand primary and Cornflower `#6B8BF5` as the secondary accent. Twitch purple (`#9146FF`) is reserved for Twitch sign-in/connect actions. Amber = paused/warning, emerald = live/connected. Light mode is a cool paper scheme with a navy cast and stays fully supported. Montserrat for display, IBM Plex Sans for body, IBM Plex Mono for labels and numerals.

- **Primary on light** is Cerulean darkened to `oklch(0.49 0.105 230)` so it holds AA as text and under `/10` tints; on dark it is the bright cerulean with a dark navy `primary-foreground`.
- **`--success` on light sits at L 0.49** so the 11px StatusChip live text clears 4.5:1 on its own tinted fill. `--warning` gets the same treatment.
- **Borders have weight.** Functional borders need to read against the paper background (WCAG 1.4.11-adjacent): `--border` is 28% / 14% (light / dark) and `--input` heavier at 38% / 22%. `--hairline` (18% / 10%) is the decorative rule the docs use for `--color-fd-border` and `--sidebar-border`.

`apps/web/src/lib/__tests__/tokens-contrast.test.ts` recomputes these from the oklch values: foreground and muted-foreground on background, primary-foreground on primary, and success/warning chip text on its `/10` tint over `--card` must all be at least 4.5:1 in both schemes.

## Overlay themes

`overlay.themes` mirrors the 6 presets shipped in `apps/web/src/lib/theme-presets.ts`. The full nested style objects live in the app; this file holds only the four swatch colors (`bg`, `accent`, `text`, `username`) each theme exposes, which is all the docs gallery needs. When a preset's preview colors change, update both — `apps/web/src/lib/__tests__/theme-palette-sync.test.ts` fails CI if they drift (it also checks `squircleRadius` against `SQUIRCLE_RADIUS`).

## Change process

1. Edit `design-system/tokens.json`. Never edit a generated file.
2. Run `bun run tokens` from the repo root.
3. Commit `tokens.json` **and** all generated files in the same commit. CI runs `bun run tokens && git diff --exit-code`, and `apps/web/src/lib/__tests__/design-tokens.test.ts` fails when a committed CSS file differs from what `render.ts` produces, when the two schemes have different keys, or when a hex value leaks into the palette.
4. Check contrast: `tokens-contrast.test.ts` must stay green.
5. If the change is breaking (rename, removed key, value drift), bump `meta.version` and call it out in the PR description.

## Component catalog

`components/` holds one spec per component: every module in `apps/web/src/components/` plus the two docs landing widgets. Each spec has `source:` and `tokens:` frontmatter and the same sections (Purpose, Anatomy, Props and variants, States, Accessibility, Do / Don't). `components/README.md` is the index and the page → components map; `apps/web/src/lib/__tests__/spec-catalog.test.ts` fails when a component has no spec, a `source:` path is missing, or an overlay default drifts from `timer-ring.md` / `task-card.md`. The `dw-*` utility classes are documented in `apps/fumadocs/content/docs/design-system.mdx`.
