"use client";

// A per-browser preference (the checklist's "Finish later", the bot page pick) as React
// state. Kept out of browser-storage.ts, which stays React-free for the node tests.

import { useCallback, useState, useSyncExternalStore } from "react";

import { browserStorage, noSubscribe, type PrefStorage } from "@/lib/browser-storage";

/**
 * The owner's choice: a click wins at once (held in component state, so blocked storage
 * can't swallow it), otherwise the stored value, otherwise null for the caller's default.
 * Storage is read on the client only (null during SSR and hydration, so both renders
 * agree) and never re-read after a click. `read` and `write` must be stable references.
 */
export function useStoredChoice<T>(
  read: (storage: PrefStorage | null) => T | null,
  write: (storage: PrefStorage | null, value: T) => unknown,
): [T | null, (value: T) => void] {
  const [choice, setChoice] = useState<T | null>(null);
  const stored = useSyncExternalStore(
    noSubscribe,
    () => read(browserStorage()),
    () => null,
  );
  const set = useCallback(
    (value: T) => {
      setChoice(value);
      write(browserStorage(), value);
    },
    [write],
  );
  return [choice ?? stored, set];
}
