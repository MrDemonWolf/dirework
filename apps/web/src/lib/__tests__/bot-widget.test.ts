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
    expect(read("bot/[token]/bot-console.tsx")).toContain(
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
    // It returns before the terminal notice, which paints a full screen.
    expect(console.indexOf('if (view === "widget")')).toBeLessThan(
      console.indexOf('className="bot-notice"'),
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
