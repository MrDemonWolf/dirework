---
source: apps/web/src/components/ui/skeleton.tsx
tokens: [color.scheme, radius]
---

# Skeleton

## Purpose

Loading placeholder block. Composed into the route skeletons (`DashboardSkeleton`,
`StylesSkeleton`, `BotSettingsSkeleton`), the `(app)/loading.tsx` fallback and the task list
loading rows in `TaskManager`.

## Anatomy

- A `div` with `bg-muted`, `rounded-xl` and the `skeleton-shimmer` class (index.css): a soft
  highlight sweeps across it instead of the stock opacity pulse.
- Size and shape come entirely from `className` (`h-4 w-32`, `rounded-full`, ...).

## Props and variants

All `div` attributes (`React.HTMLAttributes<HTMLDivElement>`); `className` merges. No variants.

## States

Animated while mounted. The global reduced-motion gate stops the sweep, leaving a static block.

## Accessibility

- Purely visual. The containing skeleton or region should carry the loading semantics
  (`aria-busy`, or a visually hidden "Loading" status), not each block.
- Keep the skeleton's layout close to the loaded content so nothing shifts when it swaps in.

## Do / Don't

- **Do** use one directional shimmer across the page; a dozen blocks pulsing out of phase reads as flicker.
- **Do** match the real content's size and radius.
- **Don't** add `animate-pulse` or a second animation on top.
- **Don't** render skeletons for content that loads from the server render; use them only for client fetches and `loading.tsx`.
