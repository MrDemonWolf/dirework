---
source: apps/web/src/components/bot-page-handoff.tsx
tokens: [color.scheme, radius, layout]
---

# Bot Page Handoff

## Purpose

"How will you run the bot?" — hands off the bot page URL in the setup checklist's bot step
and the Bot settings "Run the bot" card. The bot page has one token and two views: the blank
**Widget** (default; transparent, invisible on stream, for an OBS browser source or a Moblin
widget) and the **Dock / browser tab** (`?view=dock`, the visible control panel). The owner
picks one and sees only that URL, under a visible name, with that view's own steps — never
two look-alike masked rows.

## Anatomy

- A visible question, "How will you run the bot?", labelling a segmented `RadioGroup` (Base
  UI `radio-group` + `radio`) on a `bg-muted` track: two options, each an icon, a title
  ("Widget" / "Dock / browser tab") and a sub-label ("OBS browser source or Moblin widget ·
  invisible on stream" / "Controls and status · OBS custom browser dock or a pinned tab"). The
  checked option is lifted (`bg-background`, `border-input`, `text-link` icon).
- The chosen URL: a visible label ("Widget URL" / "Dock URL") over one `SecretUrlRow`
  labelled "Widget" / "Dock", keyed on the view so a switch mounts a fresh masked row.
- `renderAction` slot under the row (the card's "Open widget" / "Open dock" button).
- The view's numbered steps (`BOT_RUN_MODES` in `lib/bot-run-modes.ts`), then a footnote: run
  one or the other, not both; with Reset, that it changes both URLs.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `botToken` | `string \| null` | Null keeps the row masked with its actions off |
| `reset` | `{ onRegenerate, regenerating, description }` | Card only: Reset on the row, confirm titled "Reset both bot page URLs?" |
| `renderAction` | `(path, mode) => ReactNode` | Rendered under the row for the chosen view |

`BotPageHandoffSkeleton` (`withAction`) is the same shape while the token loads.

## States

- **Default**: Widget, on the server render and hydration.
- **Remembered**: the pick is stored per browser (`dirework.bot-view`, best-effort, read
  after hydration); a click wins at once even when storage is blocked.
- **Loading**: `BotPageHandoffSkeleton`.

## Accessibility

- `role="radiogroup"` labelled by the question; each option is a `role="radio"` named by its
  title and described by its sub-label. Arrow keys move and select, Tab enters at the checked
  option (Base UI's roving focus).
- Options are at least 44px tall on coarse pointers (`pointer-coarse:min-h-11`).
- `SecretUrlRow` supplies the named controls: "Show Widget URL", "Copy Dock URL", "Reset
  Widget URL".

## Do / Don't

- **Do** keep the copy in `lib/bot-run-modes.ts` (pure, unit-tested).
- **Do** pass the token the caller already loaded; the handoff makes no requests.
- **Don't** show both URLs at once again.
- **Don't** add Reset in the checklist; resetting stays on the card.
