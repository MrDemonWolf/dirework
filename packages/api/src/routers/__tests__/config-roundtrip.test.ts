import { describe, expect, it } from "vitest";

import {
  buildTimerStylesConfig,
  buildTaskStylesConfig,
  flattenTimerStyles,
  flattenTaskStyles,
} from "../config";

describe("timer styles round-trip", () => {
  it("flatten → add id/userId → build → should match original nested input", () => {
    const nested = {
      dimensions: { width: "280px", height: "280px" },
      background: { color: "#1a1a1a", opacity: 0.95, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#333333",
        trackOpacity: 0.6,
        fillColor: "#ffffff",
        fillOpacity: 1.0,
        width: 6,
        gap: 8,
      },
      text: {
        color: "#ffffff",
        outlineColor: "#000000",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "13px", time: "48px", cycle: "12px" },
    };

    const flat = flattenTimerStyles(nested);
    const dbRow = { id: "test", userId: "user1", ...flat };
    const rebuilt = buildTimerStylesConfig(dbRow as never);

    expect(rebuilt).toEqual(nested);
  });
});

describe("task styles round-trip", () => {
  it("flatten → add id/userId → build → should match original nested input", () => {
    const nested = {
      display: {
        showDone: true,
        showCount: true,
        useCheckboxes: true,
        crossOnDone: true,
        numberOfLines: 2,
      },
      fonts: { header: "Montserrat", body: "Roboto" },
      scroll: { enabled: true, pixelsPerSecond: 70, gapBetweenLoops: 100 },
      header: {
        height: "45px",
        background: { color: "#1a1a1a", opacity: 0.95 },
        border: { color: "#333", width: "1px", radius: "10px 10px 0 0" },
        fontSize: "18px",
        fontColor: "#ffffff",
        padding: "0 14px",
      },
      body: {
        background: { color: "#1a1a1a", opacity: 0.9 },
        border: { color: "#333", width: "1px", radius: "0 0 10px 10px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#2a2a2a", opacity: 0.8 },
        border: { color: "#444", width: "1px", radius: "8px" },
        fontSize: "15px",
        fontColor: "#e0e0e0",
        usernameColor: "#ffffff",
        padding: "8px 10px",
        marginBottom: "4px",
        maxWidth: "100%",
      },
      taskDone: {
        background: { color: "#1a1a1a", opacity: 0.6 },
        fontColor: "#888888",
      },
      checkbox: {
        size: "18px",
        background: { color: "transparent", opacity: 0 },
        border: { color: "#666", width: "2px", radius: "4px" },
        margin: { top: "1px", left: "0px", right: "8px" },
        tickChar: "\u2713",
        tickSize: "12px",
        tickColor: "#4ade80",
      },
      bullet: {
        char: "\u2022",
        size: "16px",
        color: "#888",
        margin: { top: "0px", left: "2px", right: "8px" },
      },
    };

    const flat = flattenTaskStyles(nested);
    const dbRow = { id: "test", userId: "user1", ...flat };
    const rebuilt = buildTaskStylesConfig(dbRow as never);

    expect(rebuilt).toEqual(nested);
  });
});
