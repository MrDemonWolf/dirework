---
source: apps/web/src/components/styles-skeleton.tsx
tokens: [radius, layout]
---

# Styles Skeleton

## Purpose

Loading placeholder for the Theme Center. Shown by `dashboard/styles/loading.tsx` the moment
a client-side navigation starts, and by `styles-page.tsx` only when the server prefetch
failed and `config.get` is loading in the browser. A hard load never shows it: the route
holds the `(app)` shell for its prefetch (`lib/shell-hold.ts`), so the page arrives finished.

## Anatomy

Mirrors the live layout box for box, because React keeps a shown fallback up for about
300ms and anything that moves when the page lands reads as a second load:

- Header band: eyebrow rule, `h-9` title with the `size-9` options button, subtitle.
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

Decorative blocks with no text and nothing to focus.

## Do / Don't

- **Do** update it whenever `styles-page.tsx` changes its layout.
- **Don't** render editors over default values instead of this skeleton while loading.
