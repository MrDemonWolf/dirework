---
source: apps/web/src/components/auto-scale.tsx
tokens: []
---

# Auto Scale

## Purpose

Scales a fixed-size child up or down to fill its parent while keeping the aspect ratio. The
timer overlay draws `TimerDisplay` at the fixed pixel size in `config.dimensions`; without
this wrapper a 300×300 timer would sit tiny in the corner of a large OBS browser source.
Used by the timer overlay page (`app/(overlay)/overlay/t/[token]/page.tsx`).

## Anatomy

- Outer container: `flex h-full w-full items-center justify-center overflow-hidden`, so the
  child is centered in the source.
- Inner wrapper: `transform: scale(n)` with `transform-origin: center`.
- A `ResizeObserver` watches both the container and the child; the scale is
  `min(containerW / childW, containerH / childH) × margin`. `offsetWidth/Height` read the
  pre-transform size, so the applied scale never feeds back into the measurement.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactNode` | required | The fixed-size element to fit |
| `margin` | `number` | `0.98` | Fraction of the fitted size to use, leaving a sliver of breathing room |

No variants.

## States

- **Before measurement:** scale `1` (the child renders at its configured size).
- **Measured:** fills the container on its limiting axis.
- **Zero-size container or child:** the scale is left unchanged (no divide-by-zero).

## Accessibility

Purely visual. It adds no roles or names; the child keeps its own semantics.

## Do / Don't

- **Do** wrap only fixed-pixel content (the timer widget) in it.
- **Do** give the parent a real height (an `h-full` chain or the OBS viewport).
- **Don't** wrap fluid layouts such as `TaskListDisplay`, which fill the source on their own.
- **Don't** size the child in `%`; the measurement needs a definite box.
