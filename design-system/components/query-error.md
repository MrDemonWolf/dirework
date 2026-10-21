---
source: apps/web/src/components/query-error.tsx
tokens: [color.scheme, radius]
---

# Query Error

## Purpose

Inline failed-first-load state with a Retry button. Used by the dashboard, the Theme Center
and bot settings pages, `TaskManager` and `BotConsoleCard`. Render it only when a query has
no data at all: a failed background refetch keeps the last payload, and tearing down a
populated editor (with unsaved edits) over one blip would be worse than stale data. Never
render editors over defaults instead of this.

## Anatomy

A `space-y-3` stack: a `Callout` with the given title and the fixed body "Check your
connection, then try again.", then an outline sm `Button` with a `RefreshCw` icon and the
label "Retry".

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | required | What failed ("Couldn't load your tasks") |
| `onRetry` | `() => void` | required | Usually the query's `refetch` |
| `retrying` | `boolean` | `false` | Disables Retry and spins its icon |
| `className` | `string` | none | Merged onto the wrapper |

## States

Idle (Retry enabled) and retrying (Retry disabled, icon spinning).

## Accessibility

- The `Callout` carries the alert semantics (e2e reads `getByRole("alert")`).
- Retry is a real button named "Retry"; it stays in the tab order unless retrying.

## Do / Don't

- **Do** show it only when `data` is undefined and the query errored.
- **Do** write a specific `title`.
- **Don't** show it for background refetch failures; the global toast handler covers those.
- **Don't** render it next to editors filled with defaults.
