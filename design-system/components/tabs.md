---
source: apps/web/src/components/ui/tabs.tsx
tokens: [color.scheme, radius]
---

# Tabs

## Purpose

Base UI `Tabs` for switching panels in place. Used by the Theme Center (`styles-page.tsx`:
Timer style / Task style / Phase labels), the Bot settings Replies page (`replies-page.tsx`:
Task / Timer replies) and the dashboard's OBS sources (`obs-sources.tsx`: Timer / Tasks).

The module also holds two shared pieces:

- the app's one **segmented-control recipe** (`segmentedTrack`, `segmentedItem`): the tab
  lists, the Theme Center's Timer / Tasks preview toggle (`style-preview-panel.tsx`) and the
  bot page handoff's Widget / Dock radios (`bot-page-handoff.tsx`) all wear it;
- the **unsaved-changes dot** (`UnsavedDot`): a dirty tab and a Replies group holding an edit
  (`message-editor.tsx`) both show it.

## Anatomy

- **Tabs** (root): flex, `gap-2`, column when horizontal.
- **TabsList**: the segmented track (`segmentedTrack`), `h-8` horizontal (`h-auto` on coarse
  pointers), `text-muted-foreground`. The `line` variant drops the track for a transparent row.
- **TabsTrigger**: a segment (`segmentedItem`), `px-1.5 py-0.5`, `text-xs font-medium`, `size-4`
  icons, at least 44px tall on coarse pointers (`pointer-coarse:min-h-11`, pinned by
  `touch-targets.test.ts`). With `dirty`, an `UnsavedDot` follows the label. In the `line`
  variant the active tab drops the wash and the edge and shows a 2px underline (`after:` bar).
- **TabsContent**: `flex-1`, `text-xs/relaxed`, `rounded-md`; a Tab stop (Base UI `tabIndex=0`), so keyboard focus draws a 2px `outline-ring` offset 4px (no outline otherwise).
- **Segmented recipe** (class strings; each control adds its own layout: flex or grid, gaps,
  sizes):
  - `segmentedTrack`: `rounded-xl bg-muted p-0.75`, a neutral track.
  - `segmentedItem`: `rounded-lg`, a 1px transparent border, `text-muted-foreground`,
    `hover:text-foreground`, the standard focus ring. **Selected**, in the blue accent and the
    same in both themes (no `dark:` override): a `border-primary` edge, a `bg-primary/10` wash
    and a `text-link` label. It is keyed on each control's own state: `data-active` (Base UI
    Tab), `aria-pressed="true"` (a toggle button) and `data-checked` (Base UI Radio).
- **UnsavedDot**: a `size-1.5 shrink-0 rounded-full bg-warning` dot (`aria-hidden`,
  `data-slot="unsaved-dot"`) plus sr-only "(unsaved changes)".

## Props and variants

| Export | Props |
|---|---|
| `Tabs` | `orientation?: "horizontal" \| "vertical"` (default `"horizontal"`), `value`, `defaultValue`, `onValueChange` |
| `TabsList` | `variant?: "default" \| "line"` (default `"default"`: the `segmentedTrack`; `line`: transparent, `gap-1`) |
| `TabsTrigger` | `value`, `disabled`, `dirty?: boolean` (adds the `UnsavedDot`) |
| `TabsContent` | `value` |
| `tabsListVariants` | exported `cva` for custom lists |
| `segmentedTrack` / `segmentedItem` | class strings for any segmented control; compose with `cn()` |
| `UnsavedDot` | no props; for a control outside a tab list that flags pending edits |

## States

- Segment: idle (`text-muted-foreground`), hover (`text-foreground`; a selected segment keeps
  its look), selected (edge, wash, link label), focus-visible, disabled / `aria-disabled`
  (tabs: 50%, no pointer).
- Dirty: the amber dot after the label, on an idle or the selected tab.
- Contrast (`tokens-contrast.test.ts`, `design-system/contrast.md`): the selected label is AA
  on its wash (6.7:1 dark, 6.1:1 light), the edge and the unsaved dot are at least 3:1 on the
  track and on the wash, and idle labels are AAA on the track.

## Accessibility

- `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected` and `aria-controls`.
- Arrow keys move between tabs (Up/Down when vertical), Home/End jump; Tab moves into the panel.
- `dirty` puts "(unsaved changes)" in the tab's name ("Timer style (unsaved changes)", "Task
  replies (unsaved changes)"); e2e `40-theme-center` and `50-bot-settings` pin both. Don't
  override the name with `aria-label`.
- The selected segment is marked by its 3:1 edge as well as its label color, so it doesn't
  rely on color alone.
- Focus-visible uses the standard `ring-2 ring-ring` (README "Focus"); on a selected segment it
  thickens the blue edge.

## Do / Don't

- **Do** build any new segmented control on `segmentedTrack` / `segmentedItem`, and never give
  one control its own selected look.
- **Do** mark pending edits with `dirty` or `UnsavedDot`, never a hand-made dot.
- **Do** keep tab labels to one or two words.
- **Do** keep unsaved edits across tab switches (the editors share one dirty state and SaveBar).
- **Don't** use tabs for sequential steps; that is a checklist or wizard.
- **Don't** nest tab sets.
