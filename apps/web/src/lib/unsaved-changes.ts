/**
 * Client-side registry connecting the mounted UnsavedChangesGuard to actions
 * that leave the page without a link click (e.g. Sign out in the user menu).
 * Browser-only state; never imported by server code.
 */

/** Asks the user to confirm discarding edits; calls `proceed` only on confirm. */
export type DiscardConfirm = (proceed: () => void) => void;

let activeConfirm: DiscardConfirm | null = null;

/** Register the guard's confirm while its page is dirty. Returns the unregister. */
export function registerDiscardConfirm(confirm: DiscardConfirm): () => void {
  activeConfirm = confirm;
  return () => {
    if (activeConfirm === confirm) activeConfirm = null;
  };
}

/** Run `proceed` now, or after the user confirms when a page has unsaved edits. */
export function confirmDiscardIfDirty(proceed: () => void): void {
  if (activeConfirm) activeConfirm(proceed);
  else proceed();
}
