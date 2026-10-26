import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOT_RUN_MODES,
  BOT_VIEW_KEY,
  DEFAULT_BOT_VIEW,
  botRunMode,
  readBotView,
  writeBotView,
} from "../bot-run-modes";
import type { PrefStorage } from "../browser-storage";
import { SETUP_STEPS } from "../setup-steps";

/** An in-memory Storage slice. */
function memory(initial: Record<string, string> = {}): PrefStorage & { data: typeof initial } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: PrefStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("BOT_RUN_MODES", () => {
  it("offers the widget first (the default) and the dock, one option per view", () => {
    expect(BOT_RUN_MODES.map((mode) => mode.view)).toEqual(["widget", "dock"]);
    expect(DEFAULT_BOT_VIEW).toBe("widget");
    expect(botRunMode("widget").title).toBe("Widget");
    expect(botRunMode("dock").title).toBe("Dock / browser tab");
  });

  it("names each URL row differently, so the two can never look alike", () => {
    const labels = BOT_RUN_MODES.map((mode) => `${mode.urlLabel} URL`);
    expect(labels).toEqual(["Widget URL", "Dock URL"]);
  });

  it("tells the widget's owner it draws nothing and where it runs", () => {
    const widget = botRunMode("widget");
    expect(widget.hint).toContain("invisible on stream");
    expect(widget.hint).toContain("Moblin");
    expect(widget.steps.join(" ")).toContain("Shutdown source when not visible");
    expect(widget.steps.join(" ")).not.toMatch(/400 ?[×x] ?200/);
  });

  it("covers the OBS dock and a pinned tab, and warns that closing the dock stops the bot", () => {
    const dock = botRunMode("dock");
    expect(dock.hint).toContain("pinned tab");
    expect(dock.steps.join(" ")).toContain("Custom Browser Docks");
    expect(dock.steps.join(" ")).toContain("closing it stops the bot");
  });

  it("leaves the per-view steps to the handoff: the checklist step doesn't repeat them", () => {
    const step = SETUP_STEPS.find((s) => s.id === "botSource");
    expect(step?.action).not.toMatch(/dock|400|pinned/i);
    expect(step && "notes" in step).toBe(false);
  });
});

describe("readBotView / writeBotView", () => {
  it("round-trips a pick under the shared key", () => {
    const storage = memory();
    expect(readBotView(storage)).toBeNull();
    expect(writeBotView(storage, "dock")).toBe(true);
    expect(storage.data[BOT_VIEW_KEY]).toBe("dock");
    expect(readBotView(storage)).toBe("dock");
  });

  it("ignores an unknown stored value (an old build's, or hand-edited)", () => {
    expect(readBotView(memory({ [BOT_VIEW_KEY]: "source" }))).toBeNull();
  });

  it("never throws when storage is missing or blocked", () => {
    expect(readBotView(null)).toBeNull();
    expect(readBotView(throwing)).toBeNull();
    expect(writeBotView(null, "dock")).toBe(false);
    expect(writeBotView(throwing, "dock")).toBe(false);
  });
});

describe("BotPageHandoff source contract", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/bot-page-handoff.tsx"),
    "utf8",
  );

  it("is a labelled radiogroup with 44px options on coarse pointers", () => {
    expect(source).toContain('from "@base-ui/react/radio-group"');
    expect(source).toMatch(/<RadioGroup\s+aria-labelledby=/);
    expect(source).toMatch(/<Radio\.Root[\s\S]*?pointer-coarse:min-h-11/);
  });

  it("shows one URL row, with a visible label, remounted per view", () => {
    expect(source.match(/<SecretUrlRow/g)).toHaveLength(1);
    expect(source).toContain("{mode.urlLabel} URL</p>");
    expect(source).toMatch(/<SecretUrlRow\s+key=\{view\}/);
  });

  it("makes no requests of its own", () => {
    expect(source).not.toMatch(/useQuery|useMutation|trpc/);
  });
});
