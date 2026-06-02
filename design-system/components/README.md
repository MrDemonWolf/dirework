# Component Catalog

Shared UI primitives for Dirework's marketing + docs surfaces. These are implemented as `dw-*` utility classes in `apps/fumadocs/src/app/global.css`, backed by the `--ds-*` tokens from `tokens.generated.css`.

| Component | Class(es) | Purpose |
|---|---|---|
| [Button](./button.md) | `dw-btn`, `dw-btn-primary`, `dw-btn-secondary`, `dw-btn-ghost` | Primary calls to action |
| [Card](./card.md) | `dw-card`, `dw-card-hover` | Content container |
| [Glass Card](./glass-card.md) | `dw-glass` | Frosted translucent surface |
| [Pill](./pill.md) | `dw-pill` | Compact metadata / trust badge |
| [Timer Ring](./timer-ring.md) | `TimerOverlayWidget` | Pomodoro progress ring (circle/squircle) |
| [Task Card](./task-card.md) | `TaskListWidget` | Viewer task grouped by author |
| [Chat Bubble](./chat-bubble.md) | `ChatCommandWidget` | Twitch chat command preview |
| [Theme Swatch](./theme-swatch.md) | `ThemeGallery` | Overlay theme preview grid |

## Principles

- **Token-first.** Never hardcode a hex/size that exists as a `--ds-*` token.
- **Two themes, always.** Every component must read in light and dark. Test both.
- **Reduced motion.** All animated primitives honor `prefers-reduced-motion: reduce`.
- **On brand.** Violet brand, Montserrat display, Roboto body. Twitch purple is a *partner* color, used only where Twitch is referenced.
