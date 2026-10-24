---
source: apps/web/src/components/bot-settings/bot-section-nav.tsx
tokens: [color.scheme, layout, z]
---

# Bot Section Nav

## Purpose

The sticky link bar under the Bot settings heading (`dashboard/bot/layout.tsx`): one link per sub-page from `lib/bot-sections.ts` (Overview, Commands, Moderation). Each section is its own URL, so Back, refresh and bookmarks land where the owner was.

## Anatomy

- `<nav aria-label="Bot settings sections">`, sticky under the header (`top-header`), full-bleed hairline bottom border and a translucent background.
- A row of links, each a 44px-tall target with a 2px bottom border: `border-primary` + `text-foreground` on the current section, transparent + `text-muted-foreground` otherwise.
- Scrolls sideways on a narrow phone rather than wrapping.

## Props and variants

None. The current section comes from `usePathname()` through `activeBotSection`.

## States

- **Current**: `aria-current="page"` and the primary underline.
- **Hover**: text goes to `text-foreground`.
- **Unsaved edits on the page**: a click opens the `UnsavedChangesGuard` dialog first (the guard intercepts in-app links).

## Accessibility

- A labelled `nav` landmark with a plain list of links; the current one carries `aria-current="page"`.
- Visible focus ring on every link; transitions are off under `prefers-reduced-motion`.

## Do / Don't

- **Do** add a section to `BOT_SECTIONS`, never a hard-coded link here.
- **Do** keep `prefetch={false}`: a hover or scroll must not spend a request.
- **Don't** turn it into tabs (`role="tablist"`); these are pages.
- **Don't** add status or counts to the links; the pages hold them.
