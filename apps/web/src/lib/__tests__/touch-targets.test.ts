import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");

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

  it("only hides task-row actions when the pointer can hover, at any width", () => {
    const taskManager = read("components/task-manager.tsx");
    // `lg:opacity-0` hid Activate/Remove on touch tablets >= 1024px, where group-hover
    // (wrapped in @media (hover: hover)) can never reveal them.
    expect(taskManager).not.toContain("lg:opacity-0");
    expect(taskManager.match(/can-hover:opacity-0 group-hover:opacity-100/g)).toHaveLength(2);
  });

  it("defines the can-hover variant on a hover media query", () => {
    expect(read("index.css")).toContain("@custom-variant can-hover (@media (hover: hover));");
  });
});
