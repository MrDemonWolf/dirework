import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("touch targets", () => {
  it("gives every button size a larger minimum hit area on coarse pointers", () => {
    const expected: Record<string, string[]> = {
      default: ["pointer-coarse:min-h-11"],
      lg: ["pointer-coarse:min-h-11"],
      xs: ["pointer-coarse:min-h-9"],
      sm: ["pointer-coarse:min-h-10"],
      icon: ["pointer-coarse:min-h-11", "pointer-coarse:min-w-11"],
      "icon-lg": ["pointer-coarse:min-h-11", "pointer-coarse:min-w-11"],
      "icon-xs": ["pointer-coarse:min-h-9", "pointer-coarse:min-w-9"],
      "icon-sm": ["pointer-coarse:min-h-10", "pointer-coarse:min-w-10"],
    };
    for (const [size, classes] of Object.entries(expected)) {
      const rendered = buttonVariants({ size: size as never }).split(" ");
      for (const cls of classes) expect(rendered, size).toContain(cls);
    }
  });

  it("gives inputs a 44px minimum height on coarse pointers", () => {
    expect(read("components/ui/input.tsx")).toContain("pointer-coarse:min-h-11");
  });

  it("gives tab triggers a 44px minimum height on coarse pointers", () => {
    const tabs = read("components/ui/tabs.tsx");
    expect(tabs).toContain("pointer-coarse:min-h-11");
    // The horizontal list's fixed h-8 would clip a taller trigger.
    expect(tabs).toContain("pointer-coarse:group-data-[orientation=horizontal]/tabs:h-auto");
  });

  it("grows the switch's invisible hit area past 44px tall on coarse pointers", () => {
    const switchSource = read("components/ui/switch.tsx");
    // default: 18.4px track + 2 * 14px; sm: 14px track + 2 * 16px.
    expect(switchSource).toContain("pointer-coarse:after:-inset-y-3.5");
    expect(switchSource).toContain("pointer-coarse:data-[size=sm]:after:-inset-y-4");
  });

  it("gives section headers and reply variable chips a 44px minimum on coarse pointers", () => {
    expect(read("components/section-group.tsx")).toMatch(
      /<CollapsibleTrigger[^>]*pointer-coarse:min-h-11/,
    );
    expect(read("components/bot-settings/message-editor.tsx")).toMatch(
      /aria-label=\{`Insert \$\{token\}`\}\s+className="[^"]*pointer-coarse:min-h-11 pointer-coarse:min-w-11/,
    );
  });

  it("only hides task-row actions when the pointer can hover, at any width", () => {
    const taskManager = read("components/task-manager.tsx");
    // `lg:opacity-0` hid Activate/Remove on touch tablets >= 1024px, where group-hover
    // (wrapped in @media (hover: hover)) can never reveal them.
    expect(taskManager).not.toContain("lg:opacity-0");
    expect(taskManager.match(/can-hover:opacity-0 group-hover:opacity-100/g)).toHaveLength(2);
  });

  it("pads every full-width edge container for the side safe-area insets", () => {
    // viewport-fit=cover lets content run under a landscape notch; these must pad for it.
    const sides = "pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]";
    const appLayout = read("app/(app)/layout.tsx");
    expect(appLayout).toMatch(new RegExp(`<main[^>]*${reEscape(sides)}`));
    expect(appLayout).toMatch(new RegExp(`<footer[\\s\\S]*?${reEscape(sides)}`));
    expect(read("components/header.tsx")).toMatch(new RegExp(`<header[^>]*${reEscape(sides)}`));
    expect(read("components/save-bar.tsx")).toMatch(
      new RegExp(`data-save-bar[\\s\\S]*?${reEscape(sides)}`),
    );
  });

  it("lifts toasts above a visible Save bar on both breakpoints", async () => {
    const { TOAST_OFFSET, TOAST_MOBILE_OFFSET } = await import("@/components/providers");
    for (const offset of [TOAST_OFFSET, TOAST_MOBILE_OFFSET]) {
      expect(offset.bottom).toContain("var(--save-bar-clearance, 0px)");
    }
    // Set only while a SaveBar is mounted, so pages without one keep the plain gutter.
    expect(read("index.css")).toMatch(
      /html:has\(\[data-save-bar\]\) \{[^}]*--save-bar-clearance: 3\.5rem;/,
    );
  });

  it("offsets toasts by the safe-area insets on both breakpoints", async () => {
    const { TOAST_OFFSET, TOAST_MOBILE_OFFSET } = await import("@/components/providers");
    for (const offset of [TOAST_OFFSET, TOAST_MOBILE_OFFSET]) {
      expect(offset.bottom).toContain("env(safe-area-inset-bottom");
      expect(offset.left).toContain("env(safe-area-inset-left");
      expect(offset.right).toContain("env(safe-area-inset-right");
    }
    const providers = read("components/providers.tsx");
    expect(providers).toContain("offset={TOAST_OFFSET} mobileOffset={TOAST_MOBILE_OFFSET}");
  });

  it("defines the can-hover variant on a hover media query", () => {
    expect(read("index.css")).toContain("@custom-variant can-hover (@media (hover: hover));");
  });
});
