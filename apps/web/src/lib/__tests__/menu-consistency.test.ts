import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level contract for the shared menu/list interaction recipe: these
// are class strings, so the regression is a file that drifts back to the
// boxed hover outline or the coloured task-row edge bar.
const read = (rel: string) => readFileSync(path.join(__dirname, "../../components", rel), "utf8");

const dropdownMenu = read("ui/dropdown-menu.tsx");
const select = read("ui/select.tsx");
const taskManager = read("task-manager.tsx");
const userMenu = read("user-menu.tsx");
const header = read("header.tsx");

describe("menu interaction consistency", () => {
  it("highlights dropdown items with a fill and keeps the ring for keyboard focus", () => {
    expect(dropdownMenu).toContain("data-highlighted:bg-accent");
    expect(dropdownMenu).toContain("focus-visible:ring-inset");
    expect(dropdownMenu).not.toContain("focus:outline-2");
  });

  it("gives select items the same recipe as dropdown items", () => {
    // select.tsx imports the one recipe string rather than copying it.
    expect(select).toMatch(/import \{ menuItemRecipe \} from "@\/components\/ui\/dropdown-menu"/);
    expect(select).toContain("menuItemRecipe,");
    expect(select).not.toContain("focus:outline-2");
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
