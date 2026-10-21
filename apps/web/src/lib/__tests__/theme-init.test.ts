import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "next-themes";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OVERLAY_SURFACE, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../theme-init";

const read = (rel: string) => readFileSync(path.join(__dirname, rel), "utf8");

/**
 * next-themes' own inline script, exactly as the provider renders it with the props
 * providers.tsx passes. Ours must behave identically for every stored value.
 */
function nextThemesScript(): string {
  const html = renderToString(
    createElement(ThemeProvider, {
      attribute: "class",
      defaultTheme: "dark",
      enableSystem: true,
      disableTransitionOnChange: true,
    }),
  );
  const match = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("next-themes rendered no script");
  return match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/** Minimal <html> stand-in: a real class set, attributes, and a style object. */
function makeRoot(initial: string[] = []) {
  const classes = new Set(initial);
  const attrs = new Map<string, string>();
  return {
    classList: {
      add: (...names: string[]) => {
        for (const n of names) classes.add(n);
      },
      remove: (...names: string[]) => {
        for (const n of names) classes.delete(n);
      },
    },
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    style: { colorScheme: "" },
    classes,
    attrs,
  };
}

/** Run an inline script against stubbed browser globals. */
function run(opts: {
  script?: string;
  stored?: string | null;
  getItemThrows?: boolean;
  prefersDark?: boolean;
  initialClasses?: string[];
  pathname?: string;
}) {
  const root = makeRoot(opts.initialClasses);
  const getItem = vi.fn((key: string) => {
    if (opts.getItemThrows) throw new Error("SecurityError");
    return key === THEME_STORAGE_KEY ? (opts.stored ?? null) : null;
  });
  const matchMedia = (q: string) => ({
    matches: q === "(prefers-color-scheme: dark)" && Boolean(opts.prefersDark),
  });
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", { getItem });
  vi.stubGlobal("matchMedia", matchMedia);
  vi.stubGlobal("window", { matchMedia });
  vi.stubGlobal("location", { pathname: opts.pathname ?? "/" });
  new Function(opts.script ?? THEME_INIT_SCRIPT)();
  return {
    classes: [...root.classes].sort(),
    colorScheme: root.style.colorScheme,
    surface: root.attrs.get("data-surface"),
    getItem,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("THEME_INIT_SCRIPT", () => {
  it("defaults to dark when nothing is stored", () => {
    const r = run({ stored: null });
    expect(r.classes).toEqual(["dark"]);
    expect(r.colorScheme).toBe("dark");
    expect(r.getItem).toHaveBeenCalledWith("theme");
  });

  it("applies a stored light theme", () => {
    const r = run({ stored: "light" });
    expect(r.classes).toEqual(["light"]);
    expect(r.colorScheme).toBe("light");
  });

  it("applies a stored dark theme", () => {
    const r = run({ stored: "dark" });
    expect(r.classes).toEqual(["dark"]);
    expect(r.colorScheme).toBe("dark");
  });

  it("follows the OS for a stored system theme", () => {
    expect(run({ stored: "system", prefersDark: true }).classes).toEqual(["dark"]);
    const light = run({ stored: "system", prefersDark: false });
    expect(light.classes).toEqual(["light"]);
    expect(light.colorScheme).toBe("light");
  });

  it("applies a stale stored value verbatim, without a color-scheme, like next-themes", () => {
    const r = run({ stored: "blue", initialClasses: ["dark"] });
    expect(r.classes).toEqual(["blue"]);
    expect(r.colorScheme).toBe("");
  });

  it("falls back to dark when storage access throws", () => {
    const r = run({ getItemThrows: true });
    expect(r.classes).toEqual(["dark"]);
    expect(r.colorScheme).toBe("dark");
  });

  it("removes a stale theme class and keeps unrelated ones", () => {
    const r = run({ stored: "dark", initialClasses: ["light", "keep-me"] });
    expect(r.classes).toEqual(["dark", "keep-me"]);
  });

  it("marks OBS overlay pages so their canvas is never painted", () => {
    expect(run({ pathname: "/overlay/t/abc" }).surface).toBe(OVERLAY_SURFACE);
    expect(run({ pathname: "/overlay/l/abc" }).surface).toBe(OVERLAY_SURFACE);
    expect(run({ pathname: "/dashboard" }).surface).toBeUndefined();
    expect(run({ pathname: "/bot/abc" }).surface).toBeUndefined();
  });

  it.each([
    { stored: null },
    { stored: "" },
    { stored: "light" },
    { stored: "dark" },
    { stored: "system", prefersDark: true },
    { stored: "system", prefersDark: false },
    { stored: "blue" },
    // Deliberately not { getItemThrows: true }: next-themes' script then does nothing (its
    // whole body is in the try), leaving the page unthemed until hydration, where the
    // provider falls back to the default. Ours applies that default (dark) up front.
  ])("matches next-themes' own script for %o", (opts) => {
    const ours = run({ ...opts, initialClasses: ["light"] });
    const theirs = run({ ...opts, initialClasses: ["light"], script: nextThemesScript() });
    expect({ classes: ours.classes, colorScheme: ours.colorScheme }).toEqual({
      classes: theirs.classes,
      colorScheme: theirs.colorScheme,
    });
  });
});

describe("theme bootstrap wiring", () => {
  it("runs the script from the root layout's <head>", () => {
    const layout = read("../../app/layout.tsx");
    expect(layout).toContain("<head>");
    expect(layout).toContain("{ __html: THEME_INIT_SCRIPT }");
    // Inside <head>, before <body>: next-themes' own script lands in <body>, too late.
    expect(layout.indexOf("THEME_INIT_SCRIPT }}")).toBeLessThan(layout.indexOf("<body className"));
  });

  it("paints the canvas with the theme everywhere except overlays", () => {
    const css = read("../../index.css");
    expect(css).toMatch(/html \{\s*color-scheme: light;\s*\}/);
    expect(css).toMatch(
      /html:not\(\[data-surface="overlay"\]\) \{\s*background-color: var\(--background\);\s*\}/,
    );
    expect(css).toMatch(
      /html\[data-surface="overlay"\] body \{\s*background-color: transparent;\s*\}/,
    );
    expect(css).toMatch(/html\.dark \{\s*color-scheme: dark;\s*\}/);
    // No unscoped html background: it would paint OBS overlays before their body arrives.
    expect(css).not.toMatch(/html \{[^}]*background/);
  });

  it("stays in sync with the next-themes provider config", () => {
    const providers = read("../../components/providers.tsx");
    expect(providers).toContain('defaultTheme="dark"');
    expect(providers).toContain("enableSystem");
    expect(providers).toContain('attribute="class"');
    // The script hard-codes next-themes' default key and themes; custom ones would desync it.
    expect(providers).not.toContain("storageKey");
    expect(providers).not.toMatch(/\bthemes=/);
  });
});
