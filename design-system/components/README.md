# Component Catalog

Shared UI primitives for Dirework's marketing + docs surfaces. These are implemented as `dw-*` utility classes in `apps/fumadocs/src/app/global.css`, which read the semantic CSS tokens defined there (`--brand-*`, `--bg-*`, `--txt-*`, `--hairline`, `--phase-*`, `--font-*`, `--dw-radius-control`).

| Component | Class(es) | Purpose |
|---|---|---|
| [Button](./button.md) | `dw-btn`, `dw-btn-primary`, `dw-btn-secondary`, `dw-btn-ghost` | Primary calls to action |
| [Card](./card.md) | `dw-card`, `dw-card-hover` | Content container |
| [Pill](./pill.md) | `dw-pill` | Compact metadata / trust badge |
| [Timer Ring](./timer-ring.md) | `TimerOverlayWidget` | Pomodoro progress ring (circle/squircle) |
| [Task Card](./task-card.md) | `TaskListWidget` | Viewer task grouped by author |
| [Chat Bubble](./chat-bubble.md) | `ChatCommandWidget` | Twitch chat command preview |
| [Theme Swatch](./theme-swatch.md) | `OverlayThemePreview` | Overlay theme preview grid |

## Principles

- **Token-first.** Never hardcode a hex/size that exists as a semantic CSS token in `global.css`.
- **Two themes, always.** Every component must read in light and dark. Test both.
- **Reduced motion.** All animated primitives honor `prefers-reduced-motion: reduce`.
- **On brand.** Cerulean brand (#00ACED), Montserrat display, IBM Plex Sans body. Twitch purple is a *partner* color, used only where Twitch is referenced.

## Focus

Hover and keyboard focus are separate signals: hover (and arrow-key highlight) paints a fill, and only keyboard focus (`focus-visible`) draws a ring. Never use `focus:` outlines, which also fire on mouse click and read as a boxed hover.

| Surface | Recipe |
|---|---|
| Menu and list items (dropdown items, select options) | `data-highlighted:bg-accent` fill + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset` (shared as `menuItemRecipe` in `apps/web/src/components/ui/dropdown-menu.tsx`) |
| Standalone controls and links | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` |
| Filled cards (a ring that must clear the fill) | the standalone recipe + `ring-offset-2 ring-offset-background` |

The inset ring keeps a menu row's focus indicator inside its 10px radius, which nests inside the popup's `rounded-2xl` padding. Button, input, tabs, section-group and theme-card still carry their own focus styles and migrate to these recipes in a later pass.
