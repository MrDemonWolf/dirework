---
source: apps/web/src/components/progressive-section.tsx
tokens: [layout]
---

# Progressive Section

## Purpose

One data-backed section of a page that loads progressively: the page's frame (headings,
greeting, panels) is static, and each section renders as soon as its own queries have data.
The page streams every query from ONE server batch (`streamQueries` in
`lib/server-query.ts`) and holds its first paint for at most `SECTIONS_READY_MS` (150ms,
`lib/progressive.ts`), so a fast load paints complete and only a section whose data is
slower shows its placeholder, then fills in on its own. Used by `/dashboard`; any page can
opt in the same way.

## Anatomy

- `ProgressiveSection`: a Suspense boundary around a gate that suspends on the section's
  in-flight queries (`sectionWait`). No DOM of its own.
- `SectionPlaceholder`: a `div` marking a placeholder's data-shaped blocks
  (`data-placeholder="<name>"`, `aria-hidden`). Static chrome a fallback repeats (a heading,
  the greeting) stays outside it.

## Props and variants

- `ProgressiveSection`: `queryKeys` (the tRPC query keys the section needs), `fallback`
  (shaped exactly like the finished section), `children`.
- `SectionPlaceholder`: `name`, `children`.

## States

- Data in the cache (first paint, or a client navigation inside the 30s freshness window):
  renders the children at once.
- Query still streaming: the fallback, until that query settles.
- Query failed: renders the children, which show their own error state (React Query
  refetches on mount, like a failed awaited prefetch).

## Accessibility

Placeholders are decorative and hidden from assistive tech; the skeleton shimmer stops under
the global reduced-motion gate. No entrance animation: a section appears in place.

## Do / Don't

- **Do** give each section a fallback with the same box as its content, so filling in never
  shifts the page.
- **Do** keep state shared by two places in one section (the dashboard's setup checklist and
  its header Setup button live in one section), so it is never decided from a pending query.
- **Don't** wrap a section in a CSS fade or rise: React reveals streamed content in batches,
  and an animation would replay on each.
- **Don't** add a query to a page without adding it to the page's one `streamQueries` batch.
