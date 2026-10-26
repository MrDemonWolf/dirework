// Per-browser preferences (the checklist's "Finish later", the bot page pick) live in
// localStorage. Component state stays the source of truth; storage only carries a choice to
// the next load, so every access is best-effort and never throws.

/** The slice of Storage the helpers use, so tests can pass a throwing fake. */
export type PrefStorage = Pick<Storage, "getItem" | "setItem">;

/** `window.localStorage`, or null where even touching it throws (blocked site data). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored value, or null when absent or storage is missing or blocked. */
export function readPref(storage: PrefStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Store a value, best-effort: false when storage is missing or throws (private mode). */
export function writePref(storage: PrefStorage | null, key: string, value: string): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** A `useSyncExternalStore` subscribe for a value read once: nothing to listen to. */
export const noSubscribe = () => () => {};
