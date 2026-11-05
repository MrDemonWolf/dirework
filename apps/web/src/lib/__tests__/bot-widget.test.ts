import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The default bot page is a blank widget composited onto a stream (OBS or Moblin): source
// contracts for the parts that must never paint. The e2e specs (bot-console, 55-bot-dock)
// check the rendered page.

const read = (rel: string) => readFileSync(path.join(__dirname, "../../app/(bot)", rel), "utf8");

describe("bot widget", () => {
  it("paints no background in the bot layout; the dock paints its own", () => {
    // The widget's canvas is left unpainted by the <head> script (theme-init.test.ts).
    expect(read("layout.tsx")).not.toMatch(/className="[^"]*\bbg-|<style/);
    expect(read("bot/[token]/bot-dock-view.tsx")).toContain(
      '<div className="min-h-dvh bg-obs-window">',
    );
  });

  it("renders the widget view, terminal phases included, for screen readers only", () => {
    const console = read("bot/[token]/bot-console.tsx");
    const widget = console.slice(console.indexOf('if (view === "widget")'));
    const block = widget.slice(0, widget.indexOf("\n  }\n"));
    expect(block).toContain('className="sr-only"');
    expect(block).toContain('role="alert"');
    expect(block).toContain('role="status"');
    // It returns before the dock view, whose terminal notice paints a full screen.
    expect(console).not.toContain("bot-notice");
    expect(console.indexOf('if (view === "widget")')).toBeLessThan(console.indexOf("<BotDockView"));
    expect(read("bot/[token]/bot-dock-view.tsx")).toContain('className="bot-notice"');
  });

  it("loads the dock's UI only for ?view=dock", () => {
    // The blank widget never renders the dock, its dialogs or the terminal notice, so
    // bot-console.tsx value-imports none of them: the dock view is a next/dynamic chunk
    // (server-rendered, so ?view=dock still paints from the server).
    const console = read("bot/[token]/bot-console.tsx");
    const valueImports = [...console.matchAll(/^import (?!type\b)[^;]*?from "([^"]+)";/gm)].map(
      (m) => m[1],
    );
    for (const dockOnly of [
      "./bot-dock",
      "./bot-dock-view",
      "./dashboard-bot-link",
      "@/components/status-chip",
      "@/components/confirm-dialog",
    ]) {
      expect(valueImports).not.toContain(dockOnly);
    }
    expect(console).toMatch(/dynamic\(\s*\(\) =>\s*import\("\.\/bot-dock-view"\)/);
  });

  it("never ticks for a chat error: one deadline timer clears it", () => {
    const console = read("bot/[token]/bot-console.tsx");
    // The 1s interval (the dock's uptime) never depends on the error state; the clear window
    // is one timeout per deadline (bot-chat-error.test.ts drives it with fake timers).
    const ticker = console.slice(console.indexOf("const tickerNeeded"));
    expect(ticker.slice(0, ticker.indexOf(";"))).not.toContain("chatErrorState");
    expect(console).toContain("watchChatErrorExpiry(chatErrorState, setChatErrorState)");
    expect(console).toContain("shownChatError(chatErrorState)");
    expect(console).not.toContain("currentChatError");
  });

  it("keeps dock-only state out of the widget's renders", () => {
    const console = read("bot/[token]/bot-console.tsx");
    // A chat line, an activity line and the last error re-render only the dock; the widget
    // still tracks the chat error, which its status and tab title read.
    expect(console).toMatch(/onCounter: \(counter\) => \{\s*if \(!dockRef\.current\) return;/);
    const push = console.slice(console.indexOf("const pushActivity"));
    const body = push.slice(0, push.indexOf("\n    };\n"));
    expect(body.indexOf("setChatErrorState")).toBeLessThan(
      body.indexOf("if (!dockRef.current) return;"),
    );
    expect(body.indexOf("if (!dockRef.current) return;")).toBeLessThan(body.indexOf("setActivity"));
    expect(body.indexOf("if (!dockRef.current) return;")).toBeLessThan(
      body.indexOf("setLastError"),
    );
  });

  it("puts the live state in the tab title", () => {
    expect(read("bot/[token]/bot-console.tsx")).toContain("document.title = botPageTitle(");
  });

  it("never paints the crash notice onto a stream", () => {
    const error = read("error.tsx");
    const widget = error.slice(error.indexOf('if (view === "widget")'));
    expect(widget.slice(0, widget.indexOf("bot-notice"))).toContain('className="sr-only"');
  });
});
