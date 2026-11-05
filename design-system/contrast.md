# Color contrast

Every text, icon and control color the web app paints, in both themes, with the WCAG level
chosen for it. `apps/web/src/lib/__tests__/tokens-contrast.test.ts` recomputes each ratio from
`tokens.json` and fails when a pairing drops below its level, so a palette edit can't quietly
regress one. The OBS overlays, the bot dock (`color.obs`) and the docs site have their own
palettes and checks (`theme-contrast.test.ts` for the overlay presets, `obs-contrast.test.ts` for
the dock, the e2e spec `85-docs-a11y` for the docs); this file covers the app UI and the
shared link token on docs inline-code backgrounds. The three unit suites share one copy of the
WCAG math (`apps/web/src/lib/__tests__/helpers/wcag.ts`, held to the reference ratios by
`wcag.test.ts`).

## Levels

| Level | Threshold | WCAG | Used for |
|---|---|---|---|
| **AAA** | 7:1 | 1.4.6 Contrast (Enhanced) | Text, wherever reaching it keeps the neutral-dark / one-blue look |
| **AA** | 4.5:1 | 1.4.3 Contrast (Minimum) | Text where a 7:1 color would change the look: white on the blue and Twitch fills, the light-mode status tones, red |
| **UI** | 3:1 | 1.4.11 Non-text Contrast | Input and select borders, focus ring, checked and unchecked controls, chart marks, status dots |

AA is the floor for every text pairing. Ratios below are against the surface the color
actually sits on; a `/NN` tint is composited over the surface under it, the way the browser
draws it.

## Text

| Pairing | Dark | Light | Level (dark / light) |
|---|---|---|---|
| Body text on background / card / popover / muted | 16.7 / 15.6 / 15.0 / 14.4 | 17.0 / 17.7 / 17.7 / 16.0 | AAA / AAA |
| Secondary button, highlighted menu item | 12.5, 12.9 | 13.1, 15.3 | AAA / AAA |
| Section summary (`foreground/80`) | 10.2 | 9.4 | AAA / AAA |
| Muted text on background | 9.4 | 7.8 | AAA / AAA |
| Muted text on card / popover | 8.8 / 8.4 | 8.1 / 8.1 | AAA / AAA |
| Muted text on muted / accent / secondary | 8.1 / 7.2 / 7.6 | 7.4 / 7.0 / 7.1 | AAA / AAA |
| Idle status chip, input placeholder, save bar hint | 8.4, 7.6, 9.3 | 7.7, 7.0, 7.9 | AAA / AAA |
| Muted text in a destructive callout | 7.8 | 6.8 | AAA tested at AA |
| Link on background / card / popover | 8.61 / 8.03 / 7.72 | 7.46 / 7.79 / 7.79 | AAA / AAA |
| Link on muted | 7.41 | 7.03 | AAA / AAA |
| Link on docs inline code (`muted/70` over background / card) | 7.82 / 7.60 | 7.16 / 7.26 | AAA / AAA |
| Link on the `primary/10` tint (active nav, accent chip) | 7.98, 7.35 | 6.46, 6.73 | AAA / AA |
| Link in the destructive callout (`foreground` on `destructive/10` over background; sign-in notice, `linkVariants` `proseOnTint`) | 15.17 | 14.28 | AAA / AAA |
| Selected segment label (`link` on the `primary/10` wash over the `muted` track: tabs, preview toggle, bot page handoff) | 6.74 | 6.11 | AA / AA |
| Muted hint on the selected segment (bot page handoff) | 7.4 | 6.4 | AAA tested at AA / AA |
| White on `--primary` (buttons) | 4.6 | 5.7 | AA / AA |
| White on `primary/90` (button hover) | 5.4 | 4.8 | AA / AA |
| White on Twitch purple `#9146FF` / hover | 4.6 / 5.8 | same | AA / AA |
| Destructive text on card / popover | 5.8 / 5.6 | 6.1 / 6.1 | AA / AA |
| Danger chip, destructive menu item (`destructive/10`) | 5.0 | 5.2 | AA / AA |
| Success text, live chip (`success/10`) | 9.0, 7.6 | 6.0, 5.2 | AAA / AA |
| Warning text, paused/unsaved chip (`warning/10`) | 10.3, 8.5 | 5.9, 5.1 | AAA / AA |
| Cornflower text, alt chip (`cornflower/10`) | 8.3, 7.1 | 6.3, 5.5 | AAA / AA |

## Non-text (3:1)

| Pairing | Dark | Light |
|---|---|---|
| Focus ring (`--ring`) on card | 7.8 | 5.7 |
| Checked switch / checkbox, done cycle dot, today's chart bar (`--primary`) on card | 4.0 | 5.7 |
| Selected segment edge (`--primary`) on the `muted` track / on its own `primary/10` wash | 3.7 / 3.3 | 5.2 / 4.5 |
| Unsaved dot (`--warning`) on an idle tab / the selected tab / a reply group header | 9.5 / 8.6 / 10.9 | 5.3 / 4.6 / 5.7 |
| Input + select border, unchecked switch track, planned cycle dot (`muted-foreground/70`) on card | 4.9 | 3.7 |
| Idle chip dot (`muted-foreground/70` on the `muted/60` chip) | 4.8 | 3.6 |
| Focus chart bars (`muted-foreground/55` dark, `/70` light) | 3.5 | 3.7 |
| Twitch icon on its `twitch/15` tile | 3.4 | 3.8 |
| `--chart-1…5` on card | ≥ 5.8 | ≥ 3.2 |

## Choices

- **Muted text is AAA in both themes.** Dark `#b3b3bc` (was zinc-400 `#a1a1aa`) and light
  `#4f4f57` (was `#5f5f68`) clear 7:1 on every surface, including the hover and secondary
  fills, and still sit well apart from the foreground, so the hierarchy holds.
- **Links are AAA on every plain surface and docs inline code.** Dark `#6bb0ff` (was
  `#68acff`), light `#004abb` (was `#004ebf`): a slightly lighter blue on near-black and a
  slightly darker blue on white, with the same oklch hue and chroma. The light muted surface
  now clears 7:1, as does the docs' `muted/70` inline-code background over the page or a card.
  Light-mode links on primary tints stay AA (6.46+). A link inside the destructive callout
  uses `foreground` instead (`proseOnTint`): `--link` is only 6.27:1 on that tint in light. Blue fills and focus rings keep their
  existing values.
- **Blue fills stay AA.** White on `--primary` needs a much darker blue to reach 7:1, which
  reads navy and loses the accent. Light `--primary` moved to `#105fd9` (was `#1866e0`) so the
  `hover:bg-primary/90` state, which failed at 4.42:1, now passes at 4.8.
- **Status tones are AAA in dark, AA in light.** Emerald, amber and cornflower already pass 7:1
  on near-black (cornflower moved to `#9babfd` to make its chip AAA). In light, 7:1 versions go
  muddy (`#00582b` green, `#7b3e00` brown), so they stay AA, each nudged darker so the 11px
  chip text clears 5:1 on its tint instead of ~4.7.
- **Red is AA.** A 7:1 red is salmon on dark (`#ff7d76`) and maroon on light (`#a00000`); both
  read less like "destructive". Light red moved to `#c40e22` for chip margin.
- **Twitch purple is a brand color** and stays `#9146FF` (white label AA).
- **Segmented controls share one selected look.** The tabs drew their selected segment
  lighter than the track in dark (`bg-input/30`) while the Theme Center's preview toggle and
  the bot page handoff drew theirs darker (`bg-background`), so one screen showed two opposite
  "selected" looks. All of them now take `segmentedItem` (`ui/tabs.tsx`): the blue accent in
  both themes, a `border-primary` edge, a `primary/10` wash and a `link` label. The edge is
  what makes the state readable without color: the wash alone is about 1.1:1 against the
  track, and in dark the link and muted labels are nearly the same lightness. A solid
  `--primary` fill with a white label (AA) was ruled out: the amber unsaved dot sits on the
  selected tab, and `--warning` on light `--primary` is 1.03:1.
- **Controls.** The dark switch track used `bg-input/80` (1.5:1, invisible against the card);
  it now uses `muted-foreground/70` in both themes. Planned cycle dots moved from `/40` to
  `/70`, idle chip dots from `/60` to `/70`, and light chart bars from `/55` (2.4:1) to `/70`.

## Exempt (decorative or disabled)

WCAG does not require contrast for these; they are listed so no one "fixes" them into heavy
lines.

- `--border`, `--input`, `--hairline` and their `/NN` tints: card edges, rules and outline
  button frames. Every control they frame is identified by its own label, icon or a
  3:1 border above.
- Disabled controls (`opacity-50`, `opacity-60` on a switched-off command table): 1.4.3 exempts
  inactive components.
- `aria-hidden` ornaments: the version badge separator (`muted-foreground/50`), the setup
  progress cells (the "n of 4" text carries the count), the empty-task ring, the color input's
  divider.
- Hover-only background tints (`hover:bg-muted/40` and friends): the text on them is checked.
