---
source: apps/web/src/components/ui/callout.tsx
tokens: [color.scheme, radius]
---

# Callout

## Purpose

Inline banner for an error or a status note inside a page. Used by `QueryError`, the app
`error.tsx` boundary, `sign-in-notice.tsx`, the setup screen and the Bot settings Replies page (a
switched-off command group).

## Anatomy

- Row: icon (`size-4`, `aria-hidden`) and a text column, `gap-3`, `rounded-xl` border, `px-4 py-3`.
- Title in `font-medium`; optional body below in `text-muted-foreground`, both `text-sm`.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `ReactNode` | required | One-line summary |
| `variant` | `"destructive" \| "info"` | `"destructive"` | See below |
| `children` | `ReactNode` | none | Optional detail line |
| `className` | `string` | none | Merged |

| Variant | Box | Icon | Role |
|---|---|---|---|
| `destructive` | `border-destructive/30 bg-destructive/10` | `AlertTriangle`, `text-destructive` | `alert` |
| `info` | `border-border/60 bg-muted/40` | `Info`, `text-primary` | `status` |

## States

Static. There is no dismiss button; the parent decides when to render it.

## Accessibility

- `destructive` is `role="alert"` (announced immediately); `info` is `role="status"` (polite).
  e2e reads both via `getByRole("alert")` / `getByRole("status")`.
- Color is never the only signal: each variant has its own icon and title text.

## Do / Don't

- **Do** use `info` for neutral states ("this group is off", "optional step").
- **Do** put the action (Retry, Sign in) next to the callout, not inside the title.
- **Don't** use it for transient feedback: that is a toast (`Toaster`).
- **Don't** render a `destructive` callout for something that is not an error; it interrupts screen readers.
