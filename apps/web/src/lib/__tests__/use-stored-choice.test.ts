import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, "..", file), "utf8");

describe("useStoredChoice", () => {
  const hook = read("use-stored-choice.ts");

  it("reads storage on the client only and never re-reads it after a click", () => {
    // null during SSR and hydration, and nothing to subscribe to.
    expect(hook).toMatch(/useSyncExternalStore\(\s*noSubscribe,[\s\S]*?\(\) => null,?\s*\)/);
    // The click is kept in component state first, so blocked storage can't swallow it.
    expect(hook).toMatch(/setChoice\(value\);\s*write\(browserStorage\(\), value\);/);
    expect(hook).toContain("choice ?? stored");
  });

  it.each([
    ["../components/bot-page-handoff.tsx", "useStoredChoice(readBotView, writeBotView)"],
    [
      "../components/setup-checklist.tsx",
      "useStoredChoice(readSetupCollapsed, writeSetupCollapsed)",
    ],
  ])("%s keeps its stored preference through the hook", (file, call) => {
    const source = read(file);
    expect(source).toContain(call);
    expect(source).not.toContain("useSyncExternalStore");
  });
});
