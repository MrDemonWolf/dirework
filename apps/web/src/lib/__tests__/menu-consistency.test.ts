import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { popupSurfaceRecipe } from "@/components/ui/dropdown-menu";
import { segmentedItem, segmentedTrack, UnsavedDot } from "@/components/ui/tabs";

// Source-level contract for the shared interaction recipes: the menu/list row, the popup
// surface, the segmented control and the unsaved-changes dot. These are class strings, so the
// regression is a file that drifts back to the boxed hover outline, the coloured task-row edge
// bar, a popup on a surface of its own, its own "selected" look or its own copy of the dot.
const srcDir = path.join(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(srcDir, "components", rel), "utf8");

const dropdownMenu = read("ui/dropdown-menu.tsx");
const select = read("ui/select.tsx");
const tooltip = read("ui/tooltip.tsx");
const taskManager = read("task-manager.tsx");
const accountMenu = read("account-menu.tsx");
const header = read("header.tsx");
const tabs = read("ui/tabs.tsx");
const messageEditor = read("bot-settings/message-editor.tsx");
const repliesPage = readFileSync(
  path.join(srcDir, "app/(app)/dashboard/bot/(sections)/replies/replies-page.tsx"),
  "utf8",
);

/** Every module under apps/web/src (tests excluded), relative to it. */
function sourceFiles(dir = srcDir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [path.relative(srcDir, full).split(path.sep).join("/")] : [];
  });
}

/** The names a module imports from `from`, in any order. */
function importsFrom(source: string, from: string): string[] {
  const match = new RegExp(`import \\{([^}]*)\\} from "${from}"`).exec(source);
  return (match?.[1] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

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
    expect(popupCallSites.map(({ file }) => file)).toContain("components/account-menu.tsx");
    const repainted = popupCallSites
      .filter(({ tag }) => /\bbg-/.test(tag))
      .map(({ file, tag }) => `${file}: ${tag}`);
    expect(repainted).toEqual([]);
  });

  it("drops the coloured edge bar from active task rows", () => {
    expect(taskManager).not.toContain("border-l-2");
  });

  it("does not repeat the avatar inside the account menu", () => {
    expect(accountMenu).not.toContain("h-9 w-9");
  });

  it("leaves the dashboard links to the header instead of repeating them in the account menu", () => {
    for (const href of ['"/dashboard"', '"/dashboard/styles"', '"/dashboard/bot"']) {
      expect(accountMenu).not.toContain(href);
      expect(header).toContain(href);
    }
  });

  it("wires the mobile nav to its toggle", () => {
    expect(header).toContain('aria-controls="mobile-nav"');
    expect(header).toContain('id="mobile-nav"');
  });
});

describe("unsaved-changes dot", () => {
  it("is written once: only ui/tabs.tsx says (unsaved changes)", () => {
    const holders = sourceFiles().filter((file) =>
      readFileSync(path.join(srcDir, file), "utf8").includes("(unsaved changes)"),
    );
    expect(holders).toEqual(["components/ui/tabs.tsx"]);
  });

  it("flags a Replies tab through TabsTrigger's dirty prop, not a label and dot of its own", () => {
    expect(repliesPage).toMatch(/<TabsTrigger[^>]*\sdirty=\{dirty\[tab\]\}/);
    expect(repliesPage).not.toMatch(/<TabsTrigger[^>]*\saria-label=/);
  });

  it("marks an unsaved reply group with UnsavedDot", () => {
    expect(importsFrom(messageEditor, "@/components/ui/tabs")).toContain("UnsavedDot");
    expect(messageEditor).toContain("<UnsavedDot />");
  });

  it("is an amber dot hidden from screen readers, plus the words they read", () => {
    const html = renderToStaticMarkup(createElement(UnsavedDot));
    expect(html).toMatch(/<span aria-hidden="true" data-slot="unsaved-dot" class="[^"]*bg-warning/);
    expect(html).toContain('<span class="sr-only">(unsaved changes)</span>');
  });
});

describe("segmented controls", () => {
  const classes = (recipe: string) => recipe.split(/\s+/);

  it("mark every selected state one way, in both themes: the blue accent on a neutral track", () => {
    expect(classes(segmentedTrack)).toContain("bg-muted");
    expect(classes(segmentedItem)).toContain("text-muted-foreground");
    // Keyed on each control's own state: a Base UI Tab, a toggle button, a Base UI Radio.
    for (const state of ["data-active:", "aria-pressed:", "data-checked:"]) {
      for (const look of ["border-primary", "bg-primary/10", "text-link"]) {
        expect(classes(segmentedItem), `${state}${look}`).toContain(`${state}${look}`);
      }
    }
    // A dark-only selected style is how the tabs drew lighter than their track while the
    // preview toggle and the bot page handoff drew darker than theirs.
    expect(segmentedItem).not.toContain("dark:");
    expect(tabs).not.toMatch(/dark:(?:[\w-]+:)*(?:data-active|aria-pressed|data-checked):/);
  });

  it("builds the Tabs list and triggers from the recipes", () => {
    expect(tabs).toMatch(/default: segmentedTrack\b/);
    expect(tabs).toMatch(/cn\(\s*segmentedItem\b/);
  });

  it.each([
    ["theme-center/style-preview-panel.tsx", "TargetToggle"],
    ["bot-page-handoff.tsx", "the Widget / Dock radios"],
  ])("%s (%s) uses the recipes, not a selected look of its own", (file) => {
    const source = read(file);
    expect(importsFrom(source, "@/components/ui/tabs")).toEqual(
      expect.arrayContaining(["segmentedItem", "segmentedTrack"]),
    );
    expect(source).toMatch(/cn\(\s*segmentedTrack\b/);
    expect(source).toMatch(/cn\(\s*segmentedItem\b/);
    for (const own of [
      "bg-background text-foreground shadow-sm",
      "data-checked:bg-background",
      "data-checked:border-input",
    ]) {
      expect(source).not.toContain(own);
    }
  });
});
