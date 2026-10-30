---
source: apps/web/src/components/theme-center/phase-labels-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Phase Labels Editor

## Purpose

Theme Center editor for the timer overlay's per-phase label text (the label `TimerDisplay` shows above the countdown). Rendered on the Styles page (`styles-page.tsx`).

## Anatomy

- `SectionGroup` "Phase labels" with an intro line naming the cap (`PHASE_LABEL_MAX_GRAPHEMES`, 16 characters).
- Seven fields in phase order: Idle, Starting, Focus (`work`), Break, Long break (`longBreak`), Paused, Finished. Each: `Label`, `Input` (`#label-{key}`), `ByteBudget` (fed by `phaseLabelBudget`), and a description line.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `labels` | `PhaseLabelsConfig` | Controlled |
| `onChange` | `(labels: PhaseLabelsConfig) => void` | Emits the whole object |

## States

- **Near limit** (80% of either cap): `ByteBudget` shown and linked, counting characters, or bytes when emoji make bytes the tighter cap.
- **Over**: `aria-invalid`; the server's `phaseLabelSchema` caps each label at 16 user-perceived characters (`Intl.Segmenter` graphemes) and 48 UTF-8 bytes, so it fits the timer ring. Labels stored before the cap read back cut to it (`clampPhaseLabel`).

## Accessibility

- Each input is labelled and `aria-describedby` its description (`{id}-desc`) and, near the cap, its byte budget (`{id}-bytes`).

## Do / Don't

- **Do** count with `phaseLabelBudget`, the same two caps the server checks.
- **Do** keep the field order matching the phase lifecycle.
- **Don't** count `.length`: an emoji is one character to the owner but several code units.
- **Don't** save from here; the Styles page Save bar persists the draft.
