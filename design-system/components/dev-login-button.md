---
source: apps/web/src/components/dev-login-button.tsx
tokens: [color.scheme, font.family, tracking]
---

# Dev Login Button

## Purpose

Dev-only bypass sign-in, so the app (and the e2e suite) can be driven without Twitch.
Rendered on the viewer landing page and the setup (claim) page. It returns `null` unless the
build set `NEXT_PUBLIC_DEV_LOGIN === "true"`, so production bundles never show it.

## Anatomy

- `Button` (outline, lg, dashed border) with a `FlaskConical` icon and the label
  "Dev bypass login" ("Signing in…" while pending).
- A `console-label` caption below: "Local dev only".

## Props and variants

`DevLoginButton()` takes no props. No variants.

## States

- **Hidden:** the build flag is off.
- **Idle**, then **loading** (disabled, "Signing in…").
- **Refused (403):** the stored secret is cleared and an error toast explains why.
- **Failed:** error toast ("Is DEV_LOGIN set?").
- **Success:** hard navigation to `/dashboard`, so the new cookie is read server-side.

The per-run secret printed by `bun run dev` is asked for with `window.prompt` once per tab
session (kept in `sessionStorage`) and never baked into the bundle.

## Accessibility

A real `button` named by its visible text; the icon is decorative. Errors arrive as toasts,
which Sonner announces.

## Do / Don't

- **Do** keep it behind the build flag.
- **Don't** store the dev secret in `localStorage` or embed it in code.
- **Don't** model real sign-in on it; that is the Twitch button.
