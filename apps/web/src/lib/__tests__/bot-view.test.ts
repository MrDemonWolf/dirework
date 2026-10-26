import { describe, expect, it } from "vitest";

import {
  botPagePath,
  botPageTitle,
  parseBotView,
  recentCommandLines,
  type BotActivityLine,
} from "../bot-view";

describe("parseBotView", () => {
  it("selects the dock only for view=dock", () => {
    expect(parseBotView("dock")).toBe("dock");
    expect(parseBotView(" Dock ")).toBe("dock");
    expect(parseBotView(undefined)).toBe("widget");
    expect(parseBotView("")).toBe("widget");
    expect(parseBotView("docked")).toBe("widget");
    expect(parseBotView("source")).toBe("widget");
  });

  it("reads the first value of a repeated parameter", () => {
    expect(parseBotView(["dock", "source"])).toBe("dock");
    expect(parseBotView(["source", "dock"])).toBe("widget");
    expect(parseBotView([])).toBe("widget");
  });
});

describe("botPagePath", () => {
  it("builds the widget and dock URLs from one token", () => {
    expect(botPagePath("abc")).toBe("/bot/abc");
    expect(botPagePath("abc", "widget")).toBe("/bot/abc");
    expect(botPagePath("abc", "dock")).toBe("/bot/abc?view=dock");
  });

  it("round-trips: the dock path's query parses back to the dock", () => {
    const query = new URL(botPagePath("abc", "dock"), "https://x.test").searchParams;
    expect(parseBotView(query.get("view") ?? undefined)).toBe("dock");
  });
});

describe("botPageTitle", () => {
  it("names the bot and its state", () => {
    expect(botPageTitle("Connected")).toBe("DireWork bot · Connected");
    expect(botPageTitle("Muted")).toBe("DireWork bot · Muted");
  });
});

describe("recentCommandLines", () => {
  const line = (id: number, kind: BotActivityLine["kind"]): BotActivityLine => ({
    id,
    time: "00:00:00",
    kind,
    text: `line ${id}`,
  });

  it("keeps chat and reply lines, newest first, up to the limit", () => {
    const activity = [
      line(1, "info"),
      line(2, "chat"),
      line(3, "reply"),
      line(4, "error"),
      line(5, "chat"),
      line(6, "reply"),
    ];
    expect(recentCommandLines(activity, 10).map((l) => l.id)).toEqual([6, 5, 3, 2]);
    expect(recentCommandLines(activity, 3).map((l) => l.id)).toEqual([6, 5, 3]);
    expect(recentCommandLines(activity, 0)).toEqual([]);
    expect(recentCommandLines([], 5)).toEqual([]);
  });
});
