---
source: apps/web/src/components/theme-center/phase-labels-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Phase Labels Editor

## Purpose

Theme Center editor for the timer overlay's per-phase label text (the label `TimerDisplay` shows above the countdown). Rendered on the Styles page (`styles-page.tsx`).

## Anatomy

- `SectionGroup` "Phase labels" with an intro line.
- Seven fields in phase order: Idle, Starting, Focus (`work`), Break, Long break (`longBreak`), Paused, Finished. Each: `Label`, `Input` (`#label-{key}`), `ByteBudget`, and a description line.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `labels` | `PhaseLabelsConfig` | Controlled |
| `onChange` | `(labels: PhaseLabelsConfig) => void` | Emits the whole object |

## States

- **Near limit**: `ByteBudget` shown and linked.
- **Over**: `aria-invalid`; the server's `chatMessageSchema` caps each label in UTF-8 bytes, not characters.

## Accessibility

- Each input is labelled and `aria-describedby` its description (`{id}-desc`) and, near the cap, its byte budget (`{id}-bytes`).

## Do / Don't

- **Do** show the same byte budget as the chat-message editors.
- **Do** keep the field order matching the phase lifecycle.
- **Don't** cap labels by character count.
- **Don't** save from here; the Styles page Save bar persists the draft.
