// Close rules for the header's mobile nav, kept React-free so they are unit-tested
// with real events (header.tsx only wires them up).

/** The fields of a keydown the close rule reads. */
export type MenuKeyEvent = Pick<KeyboardEvent, "key" | "isComposing" | "keyCode">;

/**
 * Escape closes the menu, except while an IME composition is active: there Escape
 * cancels the candidate window, and closing the menu would swallow that. Some
 * browsers report the composing keydown only through the legacy keyCode 229.
 */
export function shouldCloseOnKey(event: MenuKeyEvent): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  return event.key === "Escape";
}

/** Calls `onClose` for each closing keydown on `target`; returns the unsubscribe. */
export function onEscape(target: EventTarget, onClose: () => void): () => void {
  const listener = (event: Event) => {
    if (shouldCloseOnKey(event as KeyboardEvent)) onClose();
  };
  target.addEventListener("keydown", listener);
  return () => target.removeEventListener("keydown", listener);
}

export type MobileMenuState = { open: boolean; pathname: string };

/**
 * Closes the menu when the route changes (back/forward, a link elsewhere on the page),
 * not only when one of its own links is tapped. Returns the same object when nothing
 * changed, so a caller can setState during render only on a real route change.
 */
export function closeOnRouteChange(state: MobileMenuState, pathname: string): MobileMenuState {
  if (state.pathname === pathname) return state;
  return { open: false, pathname };
}
