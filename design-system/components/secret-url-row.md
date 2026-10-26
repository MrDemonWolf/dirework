---
source: apps/web/src/components/secret-url-row.tsx
tokens: [color.scheme, radius, font.family]
---

# Secret URL Row

## Purpose

Masked URL row for the token-bearing overlay and bot page links (the dashboard's
`ObsSources` tabs, `BotConsoleCard`). The token in the path is the only credential for that public
page, so the URL stays hidden until explicitly revealed.

## Anatomy

- Read-only `input` (`panel-inset`, mono, `h-9`): 34 bullets plus the token's last six
  characters (a fingerprint) while masked; the full origin-prefixed URL once shown.
- Show/Hide (outline icon button, eye / eye-off), Copy (outline icon button).
- A hairline divider, then Reset (ghost destructive icon button inside a `ConfirmDialog`,
  wrapped in a `Tooltip`: "Reset the URL (the current one stops working)").

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | e.g. "Timer overlay"; builds every accessible name |
| `path` | `string \| null` | Null until the token loads: stays masked, actions disabled |
| `onRegenerate` | `() => void` | Called after the reset confirm |
| `regenerating` | `boolean` | Disables Reset and spins its icon |
| `resetDescription` | `string` | What breaks when the URL is reset, shown in the dialog |
| `resetTitle` | `string` | The dialog title when the reset reaches past this URL (`BotPageHandoff`: "Reset both bot page URLs?") |

## States

- **Loading** (`path` null): masked, all actions disabled.
- **Masked** / **shown**.
- **Just reset:** when `path` changes after the first load, the row reveals the new URL and
  flashes `ring-success` for 1.6s, so a regenerate is visibly different.
- Copy success/failure toasts ("Copied to clipboard" / a fallback hint).

## Accessibility

- Show button: "Show {label} URL", `aria-pressed` reflects the revealed state.
- Revealed input: textbox "{label} URL" (e2e pins `getByRole("textbox", { name: "Timer
  overlay URL", exact: true })`). While masked the input is `aria-hidden` and `tabIndex=-1`,
  and an `sr-only` line says "{label} URL hidden. Press Show to reveal it."
- Copy: "Copy {label} URL". Reset: "Reset {label} URL" (e2e: "Reset Timer overlay URL").

## Do / Don't

- **Do** derive `path` with `overlayPath()` so a missing token stays null.
- **Do** describe the consequence in `resetDescription`.
- **Don't** render the token anywhere else on the page.
- **Don't** auto-reveal except after a reset.
