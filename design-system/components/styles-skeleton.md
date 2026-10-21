---
source: apps/web/src/components/styles-skeleton.tsx
tokens: [radius, layout]
---

# Styles Skeleton

## Purpose

Loading placeholder for the Theme Center. Shown by `dashboard/styles/loading.tsx` the moment
a navigation starts, and by `styles-page.tsx` until `config.get` resolves.

## Anatomy

Mirrors the live layout so nothing jumps when data lands: a header band (eyebrow, title,
subtitle), a preset rail of five `h-32 w-36` cards, then an editor column (`lg:w-editor`, four
`h-24` blocks) beside an `h-140` preview. Container `max-w-content`. Built only from
`Skeleton`.

## Props and variants

None. `StylesSkeleton()` takes no props.

## States

Static. The pulse comes from `Skeleton` and stops under reduced motion.

## Accessibility

Decorative blocks with no text and nothing to focus.

## Do / Don't

- **Do** update it whenever `styles-page.tsx` changes its layout.
- **Don't** render editors over default values instead of this skeleton while loading.
