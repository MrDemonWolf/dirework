---
source: apps/web/src/components/loading-status.tsx
tokens: []
---

# Loading Status

## Purpose

Announces a whole-page loading skeleton to screen readers.

## Anatomy

One `sr-only` span with `role="status"` and the text `Loading {label}…`.

## Props and variants

`label: string` names the page being loaded. No variants.

## States

Present only while its parent skeleton is rendered.

## Accessibility

The status is visually hidden but exposed as a live region. Whole-page skeleton roots carry
`aria-busy="true"`; progressive `SectionPlaceholder` wrappers stay `aria-hidden` and do not
announce their decorative blocks.

## Do / Don't

- **Do** use it once inside a whole-page loading skeleton.
- **Don't** add it to a `SectionPlaceholder` or a decorative card placeholder.
