import { describe, expect, it } from "vitest";

import { flattenTimerStyles, flattenTaskStyles } from "../config";

describe("flattenTimerStyles", () => {
  it("should flatten full input to all 19 fields", () => {
    const result = flattenTimerStyles({
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#111", opacity: 0.9, borderRadius: "50%" },
      ring: {
        enabled: true,
        trackColor: "#222",
        trackOpacity: 0.5,
        fillColor: "#fff",
        fillOpacity: 1.0,
        width: 8,
        gap: 4,
      },
      text: { color: "#eee", outlineColor: "#000", outlineSize: "2px", fontFamily: "Arial" },
      fontSizes: { label: "14px", time: "48px", cycle: "12px" },
    });

    expect(Object.keys(result)).toHaveLength(19);
    expect(result).toEqual({
      width: "300px",
      height: "300px",
      bgColor: "#111",
      bgOpacity: 0.9,
      bgBorderRadius: "50%",
      ringEnabled: true,
      ringTrackColor: "#222",
      ringTrackOpacity: 0.5,
      ringFillColor: "#fff",
      ringFillOpacity: 1.0,
      ringWidth: 8,
      ringGap: 4,
      textColor: "#eee",
      textOutlineColor: "#000",
      textOutlineSize: "2px",
      textFontFamily: "Arial",
      fontSizeLabel: "14px",
      fontSizeTime: "48px",
      fontSizeCycle: "12px",
    });
  });

  it("should handle partial input — only dimensions", () => {
    const result = flattenTimerStyles({
      dimensions: { width: "200px" },
    });
    expect(result).toEqual({ width: "200px" });
  });

  it("should return empty object for empty input", () => {
    const result = flattenTimerStyles({});
    expect(result).toEqual({});
  });

  it("should handle undefined nested sections gracefully", () => {
    const result = flattenTimerStyles({
      ring: undefined,
      text: undefined,
    });
    expect(result).toEqual({});
  });
});

describe("flattenTaskStyles", () => {
  it("should flatten full input to all expected fields", () => {
    const result = flattenTaskStyles({
      display: { showDone: true, showCount: true, useCheckboxes: true, crossOnDone: false, numberOfLines: 3 },
      fonts: { header: "Montserrat", body: "Roboto" },
      scroll: { enabled: true, pixelsPerSecond: 70, gapBetweenLoops: 100 },
      header: {
        height: "45px",
        background: { color: "#1a1a1a", opacity: 0.95 },
        border: { color: "#333", width: "1px", radius: "10px" },
        fontSize: "18px",
        fontColor: "#fff",
        padding: "0 14px",
      },
      body: {
        background: { color: "#1a1a1a", opacity: 0.9 },
        border: { color: "#333", width: "1px", radius: "10px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#2a2a2a", opacity: 0.8 },
        border: { color: "#444", width: "1px", radius: "8px" },
        fontSize: "15px",
        fontColor: "#e0e0e0",
        usernameColor: "#fff",
        padding: "8px 10px",
        marginBottom: "4px",
        maxWidth: "100%",
      },
      taskDone: {
        background: { color: "#1a1a1a", opacity: 0.6 },
        fontColor: "#888",
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
    });

    // 5 display + 2 fonts + 3 scroll + 9 header + 7 body + 11 task + 3 taskDone + 12 checkbox + 6 bullet = 58
    // Actually let me count from the flatten function:
    // display: 5, fonts: 2, scroll: 3, header: 9, body: 7, task: 11, taskDone: 3, checkbox: 12, bullet: 6 = 58
    // Wait, let me count properly from the source:
    // display: showDone, showCount, useCheckboxes, crossOnDone, numberOfLines = 5
    // fonts: header, body = 2
    // scroll: enabled, pixelsPerSecond, gapBetweenLoops = 3
    // header: height, bgColor, bgOpacity, borderColor, borderWidth, borderRadius, fontSize, fontColor, padding = 9
    // body: bgColor, bgOpacity, borderColor, borderWidth, borderRadius, paddingVertical, paddingHorizontal = 7
    // task: bgColor, bgOpacity, borderColor, borderWidth, borderRadius, fontSize, fontColor, usernameColor, padding, marginBottom, maxWidth = 11
    // taskDone: bgColor, bgOpacity, fontColor = 3
    // checkbox: size, bgColor, bgOpacity, borderColor, borderWidth, borderRadius, marginTop, marginLeft, marginRight, tickChar, tickSize, tickColor = 12
    // bullet: char, size, color, marginTop, marginLeft, marginRight = 6
    // Total = 58
    expect(Object.keys(result)).toHaveLength(58);
    expect(result).toHaveProperty("displayShowDone", true);
    expect(result).toHaveProperty("fontHeader", "Montserrat");
    expect(result).toHaveProperty("scrollEnabled", true);
    expect(result).toHaveProperty("headerBgColor", "#1a1a1a");
    expect(result).toHaveProperty("bodyPaddingVertical", "8px");
    expect(result).toHaveProperty("taskUsernameColor", "#fff");
    expect(result).toHaveProperty("taskDoneFontColor", "#888");
    expect(result).toHaveProperty("checkboxTickChar", "\u2713");
    expect(result).toHaveProperty("bulletChar", "\u2022");
    expect(result).toHaveProperty("bulletMarginRight", "8px");
  });

  it("should handle partial nested input", () => {
    const result = flattenTaskStyles({
      display: { showDone: false },
      header: { background: { color: "#000" } },
    });
    expect(result).toEqual({
      displayShowDone: false,
      headerBgColor: "#000",
    });
  });

  it("should return empty object for empty input", () => {
    const result = flattenTaskStyles({});
    expect(result).toEqual({});
  });

  it("should handle deeply nested partial — only checkbox margin", () => {
    const result = flattenTaskStyles({
      checkbox: { margin: { top: "2px" } },
    });
    expect(result).toEqual({ checkboxMarginTop: "2px" });
  });
});
