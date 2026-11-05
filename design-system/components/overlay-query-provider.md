---
source: apps/web/src/components/overlay-query-provider.tsx
tokens: []
---

# Overlay Query Provider

## Purpose

The `(overlay)` layout's only client provider: React Query (`QueryClientProvider` over the
shared `getQueryClient()` from `utils/query-client.ts`), because both OBS overlays poll with
`useQuery`. Non-visual. It deliberately leaves out the theme provider (the overlays never read
the theme; the root `<head>` script still sets the class and marks the canvas transparent), the
devtools and the dashboard's `/rpc` options proxy, so an overlay loads none of them.

## Anatomy

`QueryClientProvider` around the overlay page. Nothing else.

## Props and variants

| Export | Notes |
|---|---|
| `OverlayQueryProvider({ children })` | The wrapper, mounted by `app/(overlay)/layout.tsx` |

## States

None. Not applicable: renders no UI of its own.

## Accessibility

Not applicable: renders no UI of its own.

## Do / Don't

- **Do** keep it to React Query: every import here lands in each OBS source's first load.
- **Don't** import `utils/trpc.ts` (the `/rpc` options proxy) or `Providers`; overlays call
  `publicTrpc` from `utils/public-trpc.ts`.
- **Don't** create a second `QueryClient`; use `getQueryClient()`.
