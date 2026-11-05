import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { popupSurfaceRecipe } from "@/components/ui/dropdown-menu";

// Source-level contract for the shared menu recipes (the row interaction and the popup
// surface): these are class strings, so the regression is a file that drifts back to the
// boxed hover outline, the coloured task-row edge bar, or a popup on a surface of its own.
const srcDir = path.join(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(srcDir, "components", rel), "utf8");

const dropdownMenu = read("ui/dropdown-menu.tsx");
const select = read("ui/select.tsx");
const tooltip = read("ui/tooltip.tsx");
const taskManager = read("task-manager.tsx");
const userMenu = read("user-menu.tsx");
const header = read("header.tsx");

/** Whether `source` imports `name` from the dropdown-menu primitive. */
const importsFromDropdownMenu = (source: string, name: string) =>
  new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "@/components/ui/dropdown-menu"`).test(
    source,
  );

/** Every `.tsx` module under src/, relative to it, with its source. */
const tsxSources = (readdirSync(srcDir, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".tsx") && !file.split(path.sep).includes("__tests__"))
  .map((file) => ({
    file: file.split(path.sep).join("/"),
    source: readFileSync(path.join(srcDir, file), "utf8"),
  }));

/** One class string of the popup motion, to count the places that type it out. */
const POPUP_MOTION = "data-starting-style:scale-[0.98]";

/** The opening tag of every popup content element rendered outside ui/ (`=>` may sit inside). */
const popupCallSites = tsxSources
  .filter(({ file }) => !file.startsWith("components/ui/"))
  .flatMap(({ file, source }) =>
    [
      ...source.matchAll(/<(?:DropdownMenuContent|SelectContent|TooltipContent)\b(?:=>|[^>])*>/g),
    ].map((match) => ({ file, tag: match[0] })),
  );

describe("menu interaction consistency", () => {
  it("highlights dropdown items with a fill and keeps the ring for keyboard focus", () => {
    expect(dropdownMenu).toContain("data-highlighted:bg-accent");
    expect(dropdownMenu).toContain("focus-visible:ring-inset");
    expect(dropdownMenu).not.toContain("focus:outline-2");
  });

  it("keeps destructive rows red in every state: red focus ring, AA label on the tint", () => {
    // The blue ring on a red row read as a clash, and the dark /20 tint dropped the plain
    // red label to 4.25:1 (tokens-contrast.test.ts measures the pair below).
    expect(dropdownMenu).toContain("data-[variant=destructive]:focus-visible:ring-destructive");
    expect(dropdownMenu).toContain(
      "data-[variant=destructive]:data-highlighted:text-destructive-strong",
    );
    expect(dropdownMenu).toContain("data-[variant=destructive]:data-highlighted:bg-destructive/10");
    expect(dropdownMenu).not.toContain("bg-destructive/20");
  });

  it("gives select items the same recipe as dropdown items", () => {
    // select.tsx imports the one recipe string rather than copying it.
    expect(importsFromDropdownMenu(select, "menuItemRecipe")).toBe(true);
    expect(select).toContain("menuItemRecipe,");
    expect(select).not.toContain("focus:outline-2");
  });

  it("puts every popup on one surface: --popover, its border, shadow and motion", () => {
    // tokens-contrast.test.ts measures the menu rows on --popover, so the fill lives here once.
    expect(typeof popupSurfaceRecipe).toBe("string");
    const classes = String(popupSurfaceRecipe).split(" ");
    for (const cls of [
      "bg-popover",
      "text-popover-foreground",
      "border-border/50",
      "shadow-lg",
      "transition-[opacity,scale]",
      "data-starting-style:opacity-0",
    ]) {
      expect(classes).toContain(cls);
    }
    expect(classes).not.toContain("bg-card");
  });

  it("types the popup surface once, and the menu, select list and tooltip start from it", () => {
    // The menu, its submenu, the select list and the tooltip each carried a copy. Each popup
    // now adds only its own geometry after the recipe, so its className can still override.
    const copies = tsxSources.flatMap(({ file, source }) =>
      Array.from({ length: source.split(POPUP_MOTION).length - 1 }, () => file),
    );
    expect(copies).toEqual(["components/ui/dropdown-menu.tsx"]);
    for (const source of [dropdownMenu, select, tooltip]) {
      expect(source).toMatch(/cn\(\s*popupSurfaceRecipe,/);
    }
    expect(importsFromDropdownMenu(select, "popupSurfaceRecipe")).toBe(true);
    expect(importsFromDropdownMenu(tooltip, "popupSurfaceRecipe")).toBe(true);
  });

  it("never repaints a popup's surface at a call site", () => {
    // Every menu used to pass `bg-card`, so dark mode had menus on --card beside select lists
    // and tooltips on --popover. A call site sets width and alignment, never the fill.
    expect(popupCallSites.map(({ file }) => file)).toContain("components/user-menu.tsx");
    const repainted = popupCallSites
      .filter(({ tag }) => /\bbg-/.test(tag))
      .map(({ file, tag }) => `${file}: ${tag}`);
    expect(repainted).toEqual([]);
  });

  it("drops the coloured edge bar from active task rows", () => {
    expect(taskManager).not.toContain("border-l-2");
  });

  it("does not repeat the avatar inside the account menu", () => {
    expect(userMenu).not.toContain("h-9 w-9");
  });

  it("leaves the dashboard links to the header instead of repeating them in the account menu", () => {
    for (const href of ['"/dashboard"', '"/dashboard/styles"', '"/dashboard/bot"']) {
      expect(userMenu).not.toContain(href);
      expect(header).toContain(href);
    }
  });

  it("wires the mobile nav to its toggle", () => {
    expect(header).toContain('aria-controls="mobile-nav"');
    expect(header).toContain('id="mobile-nav"');
  });
});
