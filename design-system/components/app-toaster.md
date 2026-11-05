---
source: apps/web/src/components/app-toaster.tsx
tokens: []
---

# App Toaster

## Purpose

The app's one toast host, mounted by the `(app)` layout only (the landing page, `/setup`, the
dashboard, Theme Center and Bot settings). The OBS overlays and the bot page show no toasts,
so they load neither sonner nor the query-error toast. It also makes failed queries toast: as
its module loads it registers `toastQueryError` and `toastMutationAuthLapse`
(`lib/query-error-toast.ts`) as the reporters that `utils/trpc.ts`'s QueryCache and
MutationCache call (`lib/query-error-reporter.ts`).

## Anatomy

One `Toaster` (`ui/sonner.tsx`, `richColors`) with the safe-area offsets below. The `(app)`
layout renders it after the page grid, where Sonner's empty `aria-live` section adds no grid
row. The registration is a module-scope call, not an effect, so it is in place before an
`(app)` route renders or fetches anything.

## Props and variants

None. The module exports the offsets it passes:

| Export | Notes |
|---|---|
| `AppToaster()` | The host |
| `TOAST_OFFSET` | Desktop toast offsets: 24px plus `env(safe-area-inset-*)` on bottom/left/right, plus `--save-bar-clearance` at the bottom |
| `TOAST_MOBILE_OFFSET` | Mobile toast offsets: `1rem` plus the same insets and clearance |

## States

No toasts: an empty live region. Otherwise the `Toaster` states (`sonner.md`). While a SaveBar
is shown, `index.css` raises `--save-bar-clearance`, so toasts stack above its buttons.

## Accessibility

Sonner's `section` (`aria-label` "Notifications alt+T", `aria-live="polite"`) announces each
toast. It is in the server HTML of every `(app)` page and absent from the overlays and the bot
page. e2e reads toasts by their text ("Styles saved", the task "Undo" button).

## Do / Don't

- **Do** raise toasts with `toast()` from `sonner` on `(app)` pages only.
- **Do** keep toasts clear of the notch, the home indicator and a SaveBar via the offset
  constants.
- **Don't** mount a second `Toaster`, or this one from the root layout or `Providers`: every
  route, the OBS overlays included, would load it again.
- **Don't** load the reporter lazily (on the first error or in an effect): "Can't reach the
  DireWork API" has to show when the network is down, when a chunk fetched then would fail too.
