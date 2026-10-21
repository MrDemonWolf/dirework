"use client";

// Theme state for the app: next-themes owns the theme (localStorage, the class on <html>,
// its inline script), but its provider does NOT wrap the app. It wraps only a bridge that
// copies its value into a stable store (lib/theme-store.ts); components read it with
// `useAppTheme()`. next-themes' context value changes right after hydration whenever the OS
// scheme differs from the app theme, and a context change above a streamed Suspense
// boundary that is still waiting for its reveal makes React discard the server HTML and
// client-render it (the dashboard briefly rendered twice). The store's context value never
// changes, so nothing reaches those boundaries; only the store's subscribers re-render.

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";

import {
  type AppTheme,
  type ThemeStore,
  UNRESOLVED_THEME,
  createThemeStore,
} from "@/lib/theme-store";

/**
 * next-themes injects its anti-FOUC theme script via
 * React.createElement("script"), which React 19 flags with a dev-only
 * "Encountered a script tag while rendering React component" warning. The
 * script itself is fine — it ships in the SSR HTML and runs before paint;
 * the warning is a known false positive (next-themes #385/#387, unmaintained
 * upstream). Filter exactly that message, dev only, and pass everything
 * else through untouched.
 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering")
    ) {
      return;
    }
    originalError(...args);
  };
}

const unresolvedStore: ThemeStore = {
  get: () => UNRESOLVED_THEME,
  set: () => {},
  subscribe: () => () => {},
};

const ThemeStoreContext = React.createContext<ThemeStore>(unresolvedStore);

/** Lives inside next-themes' provider: publishes its value to the store after each change. */
function ThemeStoreBridge({ store }: { store: ThemeStore }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  React.useEffect(() => {
    store.set({ theme, resolvedTheme, setTheme });
  }, [store, theme, resolvedTheme, setTheme]);
  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  // One store per mounted provider; its identity (the context value) never changes.
  const [store] = React.useState(createThemeStore);
  return (
    <ThemeStoreContext value={store}>
      <NextThemesProvider {...props}>
        <ThemeStoreBridge store={store} />
      </NextThemesProvider>
      {children}
    </ThemeStoreContext>
  );
}

/**
 * The app's theme. Unresolved (`undefined`) on the server and during hydration, exactly
 * like next-themes' own value there, so consumers keep the mounted-state pattern.
 */
export function useAppTheme(): AppTheme {
  const store = React.useContext(ThemeStoreContext);
  return React.useSyncExternalStore(store.subscribe, store.get, store.get);
}
