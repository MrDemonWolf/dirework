# Component Catalog

One spec per component. Every module in `apps/web/src/components/` (the `ui/` primitives,
the shared components, and the `theme-center/`, `bot-settings/` and `icons/` folders) has
exactly one spec here, and so does every docs landing widget
(`apps/fumadocs/src/app/(home)/_widgets/*.tsx`; its `.ts` helpers and generated data are not
components). `apps/web/src/lib/__tests__/spec-catalog.test.ts` enforces both.

## Spec format

```markdown
---
source: apps/web/src/components/<path>.tsx
tokens: [color.scheme, radius]
---

# Name

## Purpose
## Anatomy
## Props and variants
## States
## Accessibility
## Do / Don't
```

- `source` is the one file the spec documents; it must exist, and no two specs share one.
- `tokens` lists the `tokens.json` families the component reads: `color.scheme`,
  `color.phase`, `color.console`, `color.partner`, `font.size`, `tracking`, `radius`,
  `motion`, `layout`, `z`, `overlay` (also `color.brand`, `color.brandDark`,
  `color.semantic`, `font.family`, `font.lineHeight`). `[]` when it reads none.
- Accessibility names the roles and accessible names the e2e specs (`packages/e2e/tests`)
  pin, so renaming one means updating both.
- The overlay specs (`timer-ring`, `task-card`) carry a "Pinned values" table the test
  checks against every leaf of `DEFAULT_TIMER_STYLES` / `DEFAULT_TASK_STYLES` and every
  `lib/overlay-view.ts` constant.

New component? Add its spec, a page-map entry and a catalog-group entry below, and its row
on the docs page, in the same PR, or the test fails.

## Page to components

| Page | Route | Components |
|---|---|---|
| App shell | `(app)/layout.tsx` | [header](./header.md), [user-menu](./user-menu.md), [mode-toggle](./mode-toggle.md), [version-badge](./version-badge.md), [theme-color-sync](./theme-color-sync.md) |
| Root | `app/layout.tsx` | [providers](./providers.md), [theme-provider](./theme-provider.md), [sonner](./sonner.md) |
| Viewer landing | `/` | [stream-scene](./stream-scene.md), [status-chip](./status-chip.md), [button](./button.md), [dev-login-button](./dev-login-button.md), [callout](./callout.md) |
| Setup (claim) | `/setup` | [button](./button.md), [callout](./callout.md), [dev-login-button](./dev-login-button.md), [twitch-icon](./twitch-icon.md) |
| Dashboard | `/dashboard` | [setup-checklist](./setup-checklist.md), [timer-controls](./timer-controls.md), [task-manager](./task-manager.md), [secret-url-row](./secret-url-row.md), [timer-status-badge](./timer-status-badge.md), [status-chip](./status-chip.md), [console-rule](./console-rule.md), [query-error](./query-error.md), [dashboard-skeleton](./dashboard-skeleton.md), [confirm-dialog](./confirm-dialog.md), [section-group](./section-group.md), [dropdown-menu](./dropdown-menu.md), [collapsible](./collapsible.md), [input](./input.md), [label](./label.md), [tooltip](./tooltip.md), [skeleton](./skeleton.md) |
| Theme Center | `/dashboard/styles` | [theme-browser](./theme-browser.md), [theme-card](./theme-card.md), [timer-style-editor](./timer-style-editor.md), [task-style-editor](./task-style-editor.md), [phase-labels-editor](./phase-labels-editor.md), [style-field-groups](./style-field-groups.md), [style-sections-editor](./style-sections-editor.md), [field-row](./field-row.md), [color-input](./color-input.md), [font-select](./font-select.md), [style-preview-panel](./style-preview-panel.md), [timer-ring](./timer-ring.md), [task-card](./task-card.md), [section-group](./section-group.md), [byte-budget](./byte-budget.md), [save-bar](./save-bar.md), [unsaved-changes-guard](./unsaved-changes-guard.md), [styles-skeleton](./styles-skeleton.md), [tabs](./tabs.md), [select](./select.md), [slider](./slider.md), [switch](./switch.md), [collapsible](./collapsible.md) |
| Bot settings | `/dashboard/bot/*` | [bot-section-nav](./bot-section-nav.md), [bot-live-controls](./bot-live-controls.md), [callout](./callout.md), [bot-account-card](./bot-account-card.md), [bot-console-card](./bot-console-card.md), [blocked-viewers-card](./blocked-viewers-card.md), [command-table](./command-table.md), [command-reference](./command-reference.md), [command-alias-editor](./command-alias-editor.md), [message-editor](./message-editor.md), [count-badge](./count-badge.md), [bot-settings-skeleton](./bot-settings-skeleton.md), [card](./card.md), [save-bar](./save-bar.md) |
| Timer overlay | `/overlay/t/[token]` | [timer-ring](./timer-ring.md), [auto-scale](./auto-scale.md), [font-gate](./font-gate.md) |
| Task overlay | `/overlay/l/[token]` | [task-card](./task-card.md), [font-gate](./font-gate.md) |
| Error boundaries | `error.tsx` | [callout](./callout.md), [button](./button.md) |
| Docs landing | `apps/fumadocs` | [chat-bubble](./chat-bubble.md), [theme-swatch](./theme-swatch.md), [timer-overlay-widget](./timer-overlay-widget.md), [task-list-widget](./task-list-widget.md) |

Dialogs and menus reached from any of these: [confirm-dialog](./confirm-dialog.md) (on
[alert-dialog](./alert-dialog.md)), [dropdown-menu](./dropdown-menu.md) (the account
menu, the Task Board options). [loader](./loader.md) is currently unused by any page.

## Catalog

| Group | Specs |
|---|---|
| Primitives (`ui/`) | [alert-dialog](./alert-dialog.md), [button](./button.md), [callout](./callout.md), [card](./card.md), [collapsible](./collapsible.md), [dropdown-menu](./dropdown-menu.md), [input](./input.md), [label](./label.md), [select](./select.md), [skeleton](./skeleton.md), [slider](./slider.md), [sonner](./sonner.md), [switch](./switch.md), [tabs](./tabs.md), [tooltip](./tooltip.md) |
| Status and chrome | [status-chip](./status-chip.md), [timer-status-badge](./timer-status-badge.md), [count-badge](./count-badge.md), [version-badge](./version-badge.md), [console-rule](./console-rule.md), [byte-budget](./byte-budget.md), [loader](./loader.md), [twitch-icon](./twitch-icon.md) |
| Shell | [header](./header.md), [user-menu](./user-menu.md), [mode-toggle](./mode-toggle.md), [dev-login-button](./dev-login-button.md), [providers](./providers.md), [theme-provider](./theme-provider.md), [theme-color-sync](./theme-color-sync.md), [font-gate](./font-gate.md) |
| Forms and flows | [save-bar](./save-bar.md), [confirm-dialog](./confirm-dialog.md), [unsaved-changes-guard](./unsaved-changes-guard.md), [secret-url-row](./secret-url-row.md), [section-group](./section-group.md), [query-error](./query-error.md) |
| Skeletons | [dashboard-skeleton](./dashboard-skeleton.md), [styles-skeleton](./styles-skeleton.md), [bot-settings-skeleton](./bot-settings-skeleton.md) |
| Dashboard | [setup-checklist](./setup-checklist.md), [timer-controls](./timer-controls.md), [task-manager](./task-manager.md), [stream-scene](./stream-scene.md) |
| Overlays | [timer-ring](./timer-ring.md), [task-card](./task-card.md), [auto-scale](./auto-scale.md) |
| Theme Center (`theme-center/`) | [color-input](./color-input.md), [field-row](./field-row.md), [font-select](./font-select.md), [phase-labels-editor](./phase-labels-editor.md), [style-field-groups](./style-field-groups.md), [style-preview-panel](./style-preview-panel.md), [style-sections-editor](./style-sections-editor.md), [task-style-editor](./task-style-editor.md), [theme-browser](./theme-browser.md), [theme-card](./theme-card.md), [timer-style-editor](./timer-style-editor.md) |
| Bot settings (`bot-settings/`) | [blocked-viewers-card](./blocked-viewers-card.md), [bot-account-card](./bot-account-card.md), [bot-console-card](./bot-console-card.md), [bot-live-controls](./bot-live-controls.md), [bot-section-nav](./bot-section-nav.md), [command-alias-editor](./command-alias-editor.md), [command-reference](./command-reference.md), [command-table](./command-table.md), [message-editor](./message-editor.md) |
| Docs landing (`_widgets/`) | [chat-bubble](./chat-bubble.md), [theme-swatch](./theme-swatch.md), [timer-overlay-widget](./timer-overlay-widget.md), [task-list-widget](./task-list-widget.md) |

## Principles

- **Token-first.** Never hardcode a hex, size or z-index that exists as a token; use the
  Tailwind names `tokens.json` generates (`token-bypass.test.ts` enforces it in the app).
- **Two themes, always.** Every component must read in light and dark. Test both.
- **Reduced motion.** All animated primitives honor `prefers-reduced-motion: reduce`.
- **On brand.** Neutral dark surfaces with the blue accent (`--primary` fill, `--link` text), Montserrat display, IBM Plex Sans body. Twitch purple is a *partner* color, used only where Twitch is referenced.

## Focus

Hover and keyboard focus are separate signals: hover (and arrow-key highlight) paints a fill, and only keyboard focus (`focus-visible`) draws a ring. Never use `focus:` outlines, which also fire on mouse click and read as a boxed hover.

| Surface | Recipe |
|---|---|
| Menu and list items (dropdown items, select options) | `data-highlighted:bg-accent` fill + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset` (shared as `menuItemRecipe` in `apps/web/src/components/ui/dropdown-menu.tsx`) |
| Standalone controls and links | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` |
| Filled cards (a ring that must clear the fill) | the standalone recipe + `ring-offset-2 ring-offset-background` |

The inset ring keeps a menu row's focus indicator inside its 10px radius, which nests inside the popup's `rounded-2xl` padding. Button, input, tabs, section-group and theme-card still carry their own focus styles and migrate to these recipes in a later pass.
