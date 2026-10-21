// A tiny external store that carries next-themes' state to the components that read it,
// so next-themes' provider does not have to wrap the app (components/theme-provider.tsx).
//
// Why: next-themes' context value changes right after hydration whenever the OS scheme
// differs from the app theme (its `systemTheme` state starts as the stored theme and its
// mount effect sets it to the OS's). React propagates a context change into every
// still-dehydrated Suspense boundary below the provider, and a streamed boundary whose
// reveal is still queued (React batches reveals until shortly after first paint) is then
// thrown away and client-rendered: the dashboard briefly existed twice in the DOM and lost
// its server render. A store read through useSyncExternalStore re-renders only its
// subscribers (the header toggle, ThemeColorSync, the toaster), never an ancestor of a
// boundary, so no update reaches the streamed page while it hydrates.

/** The slice of next-themes' `useTheme()` the app reads. */
export interface AppTheme {
  theme: string | undefined;
  resolvedTheme: string | undefined;
  setTheme: (theme: string) => void;
}

export interface ThemeStore {
  get: () => AppTheme;
  set: (next: AppTheme) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Before next-themes reports (and on the server), the theme is unknown: consumers render
 * their pre-mount placeholders, exactly as they did with an unresolved next-themes value.
 * `setTheme` is a no-op until then.
 */
export const UNRESOLVED_THEME: AppTheme = Object.freeze({
  theme: undefined,
  resolvedTheme: undefined,
  setTheme: () => {},
});

/** One store per provider instance (no module state): created in the provider's useState. */
export function createThemeStore(): ThemeStore {
  let snapshot = UNRESOLVED_THEME;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set(next) {
      // Keep the snapshot's identity while nothing a consumer reads changed, so
      // useSyncExternalStore does not re-render its subscribers for nothing.
      if (
        next.theme === snapshot.theme &&
        next.resolvedTheme === snapshot.resolvedTheme &&
        next.setTheme === snapshot.setTheme
      ) {
        return;
      }
      snapshot = {
        theme: next.theme,
        resolvedTheme: next.resolvedTheme,
        setTheme: next.setTheme,
      };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
