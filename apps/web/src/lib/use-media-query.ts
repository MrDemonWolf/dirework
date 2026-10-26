import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint (64rem), for layout that CSS alone can't decide. */
export const LG_MEDIA_QUERY = "(width >= 64rem)";

/**
 * Whether `query` matches, live. The server render and hydration read `false`, so a match
 * applies right after hydration: use it only where both answers render the same at first
 * (the dashboard's live preview starts off).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
