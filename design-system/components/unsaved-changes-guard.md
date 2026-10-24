---
source: apps/web/src/components/unsaved-changes-guard.tsx
tokens: []
---

# Unsaved Changes Guard

## Purpose

Stops an editor with dirty state from silently losing edits (audit M8). Rendered once by the
Theme Center (`styles-page.tsx`) and Bot settings Commands and Replies (`commands-page.tsx`, `replies-page.tsx`) pages; it also guards the Bot settings sub-nav links.

## Anatomy

Renders only a `ConfirmDialog` ("Discard unsaved changes?", confirm "Discard and leave",
cancel "Stay"). While `dirty`, it installs:

- a `beforeunload` warning (tab close, hard refresh, external links);
- a capture-phase click handler that routes same-origin `<a href="/...">` clicks through the
  dialog;
- a same-URL sentinel history entry plus a capture-phase `popstate` handler, so browser Back
  asks first;
- `registerDiscardConfirm`, so non-link actions (Sign out) can call `confirmDiscardIfDirty`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `dirty` | `boolean` | Arms the guard while true |

## States

Clean (no listeners), dirty (armed), confirming (dialog open). Stay re-arms the sentinel;
Discard performs the pending navigation. Saving while the sentinel is current pops it so the
next Back is not a no-op.

## Accessibility

The dialog is an `alertdialog` with focus trapped and returned (from `alert-dialog`).
Modified clicks (new tab), `_blank` and download links are left alone.

## Do / Don't

- **Do** render exactly one per page that has a dirty working state.
- **Do** route programmatic leaves through `confirmDiscardIfDirty`.
- **Don't** add a second `beforeunload` handler in the page.
