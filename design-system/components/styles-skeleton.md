---
source: apps/web/src/components/styles-skeleton.tsx
tokens: [radius, layout]
---

# Styles Skeleton

## Purpose

Loading placeholder for the Theme Center. Shown by `dashboard/styles/loading.tsx` the moment
a client-side navigation starts; as the page's one progressive placeholder
(`dashboard/styles/styles-section.tsx`, `data-placeholder="styles"`) when the streamed
`config.get` is slower than the first-paint deadline (`SECTIONS_READY_MS`, 800ms,
`lib/progressive.ts`), until it fills in from the same request; and by `styles-page.tsx` only
when nothing was streamed and `config.get` is loading in the browser. A fast hard load never
shows it: the route holds the `(app)` shell for its streamed batch (`lib/shell-hold.ts`), so
the page arrives finished, and the layout's render gate holds the first paint until the
document is parsed, so even a slow browser never paints the skeleton React writes ahead of it.

## Anatomy

Mirrors the live layout box for box, because React keeps a shown fallback up for about
300ms and anything that moves when the page lands reads as a second load:

- Header band: [page-header](./page-header.md)'s `PageHeaderSkeleton` (no kicker, `h-9` title
  with the `size-9` options button, the subtitle on two lines below `md`).
- Preset grid: `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`, six `h-40` cards (ThemeBrowser).
- Preview + editor in the page's order (`lg:flex-row-reverse`): the preview is a collapsed
  `h-14` bar below lg and the `lg:w-96 lg:h-116` rail at lg; the editor is the
  "2 · Customize" rule, the `h-9` tab strip, the open Colors section (`h-88`) and three
  collapsed `h-10` sections.

Container `max-w-content`. Built only from `Skeleton`.

## Props and variants

None. `StylesSkeleton()` takes no props.

## States

Static. The shimmer comes from `Skeleton` and stops under reduced motion.

## Accessibility

The whole-page skeleton has `aria-busy="true"` and announces `Loading Theme Center…` through
`LoadingStatus`. Its blocks are decorative and have nothing to focus. When rendered inside
the progressive `SectionPlaceholder`, that wrapper is `aria-hidden`.

## Do / Don't

- **Do** update it whenever `styles-page.tsx` changes its layout.
- **Don't** render editors over default values instead of this skeleton while loading.
