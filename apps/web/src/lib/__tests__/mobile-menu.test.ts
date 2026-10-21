import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { closeOnRouteChange, onEscape, shouldCloseOnKey } from "../mobile-menu";

// Vitest runs in Node, which has Event/EventTarget but no KeyboardEvent (and the web
// app ships no DOM shim), so this is a real Event dispatched through a real
// EventTarget, carrying the KeyboardEvent fields the helper reads.
class TestKeyboardEvent extends Event {
  readonly key: string;
  readonly isComposing: boolean;
  readonly keyCode: number;
  constructor(init: { key: string; isComposing?: boolean; keyCode?: number }) {
    super("keydown");
    this.key = init.key;
    this.isComposing = init.isComposing ?? false;
    this.keyCode = init.keyCode ?? 0;
  }
}

const key = (init: ConstructorParameters<typeof TestKeyboardEvent>[0]) =>
  new TestKeyboardEvent(init);

describe("shouldCloseOnKey", () => {
  it("closes on Escape", () => {
    expect(shouldCloseOnKey(key({ key: "Escape", keyCode: 27 }))).toBe(true);
  });

  it("ignores other keys", () => {
    for (const k of ["Enter", "Tab", " ", "ArrowDown", "Esc", "e"]) {
      expect(shouldCloseOnKey(key({ key: k }))).toBe(false);
    }
  });

  it("ignores Escape while an IME composition is active", () => {
    expect(shouldCloseOnKey(key({ key: "Escape", isComposing: true }))).toBe(false);
    // Legacy composing keydown: keyCode 229 without isComposing.
    expect(shouldCloseOnKey(key({ key: "Escape", keyCode: 229 }))).toBe(false);
  });
});

describe("onEscape", () => {
  it("fires on Escape keydowns only, and stops after unsubscribe", () => {
    const target = new EventTarget();
    const onClose = vi.fn();
    const unsubscribe = onEscape(target, onClose);

    target.dispatchEvent(key({ key: "Enter" }));
    target.dispatchEvent(key({ key: "Escape", isComposing: true }));
    target.dispatchEvent(key({ key: "Escape", keyCode: 229 }));
    expect(onClose).not.toHaveBeenCalled();

    target.dispatchEvent(key({ key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unsubscribe();
    target.dispatchEvent(key({ key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("closeOnRouteChange", () => {
  it("returns the same state while the path is unchanged", () => {
    const state = { open: true, pathname: "/dashboard" };
    expect(closeOnRouteChange(state, "/dashboard")).toBe(state);
  });

  it("closes the menu and records the new path on a route change", () => {
    expect(closeOnRouteChange({ open: true, pathname: "/dashboard" }, "/dashboard/bot")).toEqual({
      open: false,
      pathname: "/dashboard/bot",
    });
  });
});

describe("header wiring", () => {
  it("drives the mobile menu through the helper", () => {
    const header = readFileSync(path.join(__dirname, "../../components/header.tsx"), "utf8");
    expect(header).toContain('from "@/lib/mobile-menu"');
    expect(header).toContain("closeOnRouteChange(menu, pathname)");
    expect(header).toContain("onEscape(document,");
  });
});
