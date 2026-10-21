// The theme store keeps next-themes' provider off the app tree. next-themes' context value
// flips right after hydration when the OS scheme differs from the app theme, and a context
// change above a streamed Suspense boundary still waiting for its reveal makes React throw
// the server HTML away and client-render it (the dashboard rendered twice, e2e caught it).

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { UNRESOLVED_THEME, createThemeStore } from "../theme-store";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("createThemeStore", () => {
  it("starts unresolved, like next-themes on the server and during hydration", () => {
    expect(createThemeStore().get()).toBe(UNRESOLVED_THEME);
    expect(UNRESOLVED_THEME.resolvedTheme).toBeUndefined();
  });

  it("notifies subscribers when the theme changes and hands back the new value", () => {
    const store = createThemeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const setTheme = vi.fn();
    store.set({ theme: "dark", resolvedTheme: "dark", setTheme });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toMatchObject({ theme: "dark", resolvedTheme: "dark" });
    store.get().setTheme("light");
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("keeps the snapshot and stays quiet when nothing a consumer reads changed", () => {
    // next-themes' own value also changes for `systemTheme`, which the app never reads.
    const store = createThemeStore();
    const setTheme = () => {};
    store.set({ theme: "dark", resolvedTheme: "dark", setTheme });
    const snapshot = store.get();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ theme: "dark", resolvedTheme: "dark", setTheme });
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(snapshot);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createThemeStore();
    const listener = vi.fn();
    store.subscribe(listener)();
    store.set({ theme: "light", resolvedTheme: "light", setTheme: () => {} });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("theme provider wiring", () => {
  it("renders the app beside next-themes' provider, never inside it", () => {
    const provider = read("components/theme-provider.tsx");
    const inner = provider.match(/<NextThemesProvider[^>]*>([\s\S]*?)<\/NextThemesProvider>/);
    expect(inner?.[1].trim()).toBe("<ThemeStoreBridge store={store} />");
    expect(provider).toMatch(/<\/NextThemesProvider>\s*\{children\}/);
  });

  it("reads the theme through useAppTheme everywhere but the bridge", () => {
    const offenders = sourceFiles(src)
      .filter((file) => !file.endsWith(path.join("components", "theme-provider.tsx")))
      .filter((file) => /from "next-themes"/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(src, file));
    expect(offenders).toEqual([]);
  });
});
