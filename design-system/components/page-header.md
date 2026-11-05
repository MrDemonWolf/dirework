---
source: apps/web/src/components/page-header.tsx
tokens: [color.scheme, font.family, tracking]
---

# Page Header

## Purpose

The header band of the three dashboard pages (`/dashboard`, Theme Center, Bot settings) and its
placeholder in the client-navigation skeletons ([dashboard-skeleton](./dashboard-skeleton.md),
[styles-skeleton](./styles-skeleton.md)). One home for the page `h1` recipe, so a header change is
made once and a skeleton keeps the live band's height to the pixel. The 404 page reuses the title
class.

## Anatomy

- `PageHeader` (`data-slot="page-header"`): a wrapping row (`flex flex-wrap items-end
  justify-between gap-4`).
  - The title row (`grow`, `items-start`): an optional kicker in an `mb-2` box, the `h1` in
    `PAGE_TITLE_CLASS` (`font-heading text-3xl font-bold tracking-tight`, a 36px line box), the
    description in `PAGE_DESCRIPTION_CLASS` (`mt-1 text-sm text-muted-foreground`, 20px line
    boxes), then the optional `actions` at its top right (`shrink-0`, never wraps).
  - The optional `status` cluster (`flex flex-wrap items-center gap-2`) beside the band,
    bottom-aligned; it drops under the title when the row runs out of room (a phone).
- `PageHeaderSkeleton`: the same band, each bar inside its real line box: an `h-4.5` kicker line
  (12px mono at line-height 1.5) and its `mb-2`, an `h-9` line per title line, then `mt-1` and
  an `h-5` line per description line. Line counts are per breakpoint: `titleLines` /
  `descriptionLines` from `wrapsBelow` (`sm` or `md`) up, `narrowTitleLines` /
  `narrowDescriptionLines` under it. With a status and a title that wraps on a phone, the title
  row takes the full line there, as the live band does.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `kicker` | `ReactNode?` | Above the title (the dashboard's date line) |
| `title` | `ReactNode` | The `h1` |
| `description` | `ReactNode?` | One line under the title |
| `actions` | `ReactNode?` | Compact controls at the title's top right (Theme Center's options menu) |
| `status` | `ReactNode?` | A wrapping cluster beside the band (the dashboard's chips) |
| `className` | `string?` | The band's bottom margin |
| `suppressHydrationWarning` | `boolean?` | Title and description picked from the browser clock (the greeting) |

`PageHeaderSkeleton` takes `kicker` (boolean), the four line counts, `wrapsBelow`, and the
`actions` / `status` placeholders.

## States

None of its own.

## Accessibility

The one `h1` of the page. The skeleton renders no heading (its route's `LoadingStatus` names the
wait).

## Do / Don't

- Do use it for every full page header; `page-header.test.ts` fails on the title recipe
  anywhere else.
- Don't draw a header band by hand in a skeleton: measure the live copy at 1280px and 412px and
  set the line counts instead (`22-progressive` holds the band within 1px on a slowed client
  navigation).
