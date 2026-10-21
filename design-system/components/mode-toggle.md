---
source: apps/web/src/components/mode-toggle.tsx
tokens: [color.scheme, radius]
---

# Mode Toggle

## Purpose

Light/dark switch in the site `Header`, backed by next-themes through `useAppTheme`.
Flipping it sets an explicit `"light"` or `"dark"` theme, replacing any `"system"`
preference.

## Anatomy

Sun icon, a small `Switch` (`size="sm"`), moon icon. The icon for the current mode is
`text-foreground`; the other is `text-muted-foreground`.

## Props and variants

`ModeToggle()` takes no props. No variants.

## States

- **Pre-mount (SSR and first paint):** a static lookalike driven by the `dark` class the
  `<head>` script (`lib/theme-init.ts`) sets before paint, with the same geometry and
  colors as `Switch size="sm"`, so the swap to the real switch never flips visibly.
- **Mounted:** the live `Switch`, checked when `resolvedTheme === "dark"`.

## Accessibility

- Mounted: a `switch` named "Toggle dark mode" (pinned by e2e:
  `getByRole("switch", { name: "Toggle dark mode" })`); its checked state is the dark mode.
- Pre-mount: `role="img"` with the same label, so the name is stable across hydration; the
  fake track is `aria-hidden`.
- Keyboard: Space toggles (from the `Switch` primitive).

## Do / Don't

- **Do** keep the mounted-state pattern (hydration safety rule).
- **Don't** read `resolvedTheme` during SSR.
- **Don't** add a third "system" state here without a design pass; the toggle is binary.
