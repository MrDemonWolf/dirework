import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../theme-init";

const read = (rel: string) => readFileSync(path.join(__dirname, rel), "utf8");

/** Minimal <html> stand-in: a real class set plus a style object. */
function makeRoot(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    classList: {
      add: (...names: string[]) => {
        for (const n of names) classes.add(n);
      },
      remove: (...names: string[]) => {
        for (const n of names) classes.delete(n);
      },
    },
    style: { colorScheme: "" },
    classes,
  };
}

/** Run the real inline script against stubbed browser globals. */
function run(opts: {
  stored?: string | null;
  getItemThrows?: boolean;
  prefersDark?: boolean;
  initialClasses?: string[];
}) {
  const root = makeRoot(opts.initialClasses);
  const getItem = vi.fn((key: string) => {
    if (opts.getItemThrows) throw new Error("SecurityError");
    return key === THEME_STORAGE_KEY ? (opts.stored ?? null) : null;
  });
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", { getItem });
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q === "(prefers-color-scheme: dark)" && Boolean(opts.prefersDark),
  }));
  new Function(THEME_INIT_SCRIPT)();
  return { classes: [...root.classes], colorScheme: root.style.colorScheme, getItem };
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

  it("falls back to dark for an unknown stored value, like next-themes", () => {
    expect(run({ stored: "sepia" }).classes).toEqual(["dark"]);
  });

  it("falls back to dark when storage access throws", () => {
    const r = run({ getItemThrows: true });
    expect(r.classes).toEqual(["dark"]);
    expect(r.colorScheme).toBe("dark");
  });

  it("removes a stale theme class and keeps unrelated ones", () => {
    const r = run({ stored: "dark", initialClasses: ["light", "keep-me"] });
    expect(r.classes.sort()).toEqual(["dark", "keep-me"]);
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

  it("paints the html canvas with the theme and declares its color-scheme", () => {
    const css = read("../../index.css");
    expect(css).toMatch(
      /html \{\s*background-color: var\(--background\);\s*color-scheme: light;\s*\}/,
    );
    expect(css).toMatch(/html\.dark \{\s*color-scheme: dark;\s*\}/);
  });

  it("stays in sync with the next-themes provider config", () => {
    const providers = read("../../components/providers.tsx");
    expect(providers).toContain('defaultTheme="dark"');
    expect(providers).toContain("enableSystem");
    // The script hard-codes next-themes' default key; a custom storageKey would desync it.
    expect(providers).not.toContain("storageKey");
  });
});
