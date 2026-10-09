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
