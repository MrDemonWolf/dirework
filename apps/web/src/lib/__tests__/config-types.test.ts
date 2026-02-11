import { describe, expect, it } from "vitest";

import type {
  TimerStylesConfig,
  TaskStylesConfig,
  TimerConfigData,
  BotConfigData,
  TaskMessagesConfig,
  TimerMessagesConfig,
  PhaseLabelsConfig,
  AppConfig,
  ThemePreset,
} from "../config-types";

/**
 * These tests verify the config type interfaces are structurally correct
 * by creating conforming objects and checking key shapes.
 * Runtime extraction logic (buildTimerConfig, buildBotConfig, etc.) is
 * tested in packages/api/src/routers/__tests__/config.test.ts.
 */

describe("TimerStylesConfig shape", () => {
  const config: TimerStylesConfig = {
    dimensions: { width: "280px", height: "280px" },
    background: { color: "#1a1a1a", opacity: 0.95, borderRadius: "22%" },
    ring: {
      enabled: true,
      trackColor: "#333",
      trackOpacity: 0.6,
      fillColor: "#fff",
      fillOpacity: 1,
      width: 6,
      gap: 8,
    },
    text: { color: "#fff", outlineColor: "#000", outlineSize: "0px", fontFamily: "Montserrat" },
    fontSizes: { label: "13px", time: "48px", cycle: "12px" },
  };

  it("should have all top-level groups", () => {
    expect(Object.keys(config)).toEqual(
      expect.arrayContaining(["dimensions", "background", "ring", "text", "fontSizes"]),
    );
  });

  it("should have ring with enabled boolean", () => {
    expect(typeof config.ring.enabled).toBe("boolean");
  });
});

describe("TaskStylesConfig shape", () => {
  const config: TaskStylesConfig = {
    display: { showDone: true, showCount: true, useCheckboxes: true, crossOnDone: true, numberOfLines: 2 },
    fonts: { header: "Montserrat", body: "Roboto" },
    scroll: { enabled: true, pixelsPerSecond: 70, gapBetweenLoops: 100 },
    header: {
      height: "45px",
      background: { color: "#1a1a1a", opacity: 0.95 },
      border: { color: "#333", width: "1px", radius: "10px 10px 0 0" },
      fontSize: "18px",
      fontColor: "#fff",
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
      usernameColor: "#fff",
      padding: "8px 10px",
      marginBottom: "4px",
      maxWidth: "100%",
    },
    taskDone: { background: { color: "#1a1a1a", opacity: 0.6 }, fontColor: "#888" },
    checkbox: {
      size: "18px",
      background: { color: "transparent", opacity: 0 },
      border: { color: "#666", width: "2px", radius: "4px" },
      margin: { top: "1px", left: "0px", right: "8px" },
      tickChar: "✓",
      tickSize: "12px",
      tickColor: "#4ade80",
    },
    bullet: {
      char: "•",
      size: "16px",
      color: "#888",
      margin: { top: "0px", left: "2px", right: "8px" },
    },
  };

  it("should have scroll.enabled field", () => {
    expect(typeof config.scroll.enabled).toBe("boolean");
  });

  it("should not have task.direction field", () => {
    expect(config.task).not.toHaveProperty("direction");
  });

  it("should have all top-level groups", () => {
    expect(Object.keys(config)).toEqual(
      expect.arrayContaining([
        "display", "fonts", "scroll", "header", "body", "task", "taskDone", "checkbox", "bullet",
      ]),
    );
  });

  it("should have body padding with vertical and horizontal", () => {
    expect(config.body.padding).toEqual({ vertical: "8px", horizontal: "8px" });
  });

  it("should have checkbox background and border details", () => {
    expect(config.checkbox.background).toHaveProperty("color");
    expect(config.checkbox.background).toHaveProperty("opacity");
    expect(config.checkbox.border).toHaveProperty("width");
    expect(config.checkbox.border).toHaveProperty("radius");
  });
});

describe("AppConfig shape", () => {
  it("should compose all four sub-configs", () => {
    const config: AppConfig = {
      timerConfig: {
        workDuration: 1500000,
        breakDuration: 300000,
        longBreakDuration: 900000,
        longBreakInterval: 4,
        startingDuration: 5000,
        defaultCycles: 4,
        showHours: false,
        noLastBreak: true,
        labels: {
          idle: "Ready",
          starting: "Starting",
          work: "Focus",
          break: "Break",
          longBreak: "Long Break",
          paused: "Paused",
          finished: "Done",
        },
      },
      timerStyles: {
        dimensions: { width: "280px", height: "280px" },
        background: { color: "#1a1a1a", opacity: 0.95, borderRadius: "22%" },
        ring: { enabled: true, trackColor: "#333", trackOpacity: 0.6, fillColor: "#fff", fillOpacity: 1, width: 6, gap: 8 },
        text: { color: "#fff", outlineColor: "#000", outlineSize: "0px", fontFamily: "Montserrat" },
        fontSizes: { label: "13px", time: "48px", cycle: "12px" },
      },
      taskStyles: {
        display: { showDone: true, showCount: true, useCheckboxes: true, crossOnDone: true, numberOfLines: 2 },
        fonts: { header: "Montserrat", body: "Roboto" },
        scroll: { enabled: true, pixelsPerSecond: 70, gapBetweenLoops: 100 },
        header: { height: "45px", background: { color: "#1a1a1a", opacity: 0.95 }, border: { color: "#333", width: "1px", radius: "10px 10px 0 0" }, fontSize: "18px", fontColor: "#fff", padding: "0 14px" },
        body: { background: { color: "#1a1a1a", opacity: 0.9 }, border: { color: "#333", width: "1px", radius: "0 0 10px 10px" }, padding: { vertical: "8px", horizontal: "8px" } },
        task: { background: { color: "#2a2a2a", opacity: 0.8 }, border: { color: "#444", width: "1px", radius: "8px" }, fontSize: "15px", fontColor: "#e0e0e0", usernameColor: "#fff", padding: "8px 10px", marginBottom: "4px", maxWidth: "100%" },
        taskDone: { background: { color: "#1a1a1a", opacity: 0.6 }, fontColor: "#888" },
        checkbox: { size: "18px", background: { color: "transparent", opacity: 0 }, border: { color: "#666", width: "2px", radius: "4px" }, margin: { top: "1px", left: "0px", right: "8px" }, tickChar: "✓", tickSize: "12px", tickColor: "#4ade80" },
        bullet: { char: "•", size: "16px", color: "#888", margin: { top: "0px", left: "2px", right: "8px" } },
      },
      botConfig: {
        taskCommandsEnabled: true,
        timerCommandsEnabled: true,
        commandAliases: {},
        task: { taskAdded: "", noTaskAdded: "", noTaskContent: "", noTaskToEdit: "", taskEdited: "", taskRemoved: "", taskNext: "", adminDeleteTasks: "", taskDone: "", taskCheck: "", taskCheckUser: "", noTask: "", noTaskOther: "", notMod: "", clearedAll: "", clearedDone: "", nextNoContent: "", help: "" },
        timer: { workMsg: "", breakMsg: "", longBreakMsg: "", workRemindMsg: "", notRunning: "", streamStarting: "", wrongCommand: "", timerRunning: "", commandSuccess: "", cycleWrong: "", goalWrong: "", finishResponse: "", alreadyStarting: "", eta: "" },
      },
    };

    expect(Object.keys(config)).toEqual(
      expect.arrayContaining(["timerConfig", "timerStyles", "taskStyles", "botConfig"]),
    );
    expect(Object.keys(config.botConfig.task)).toHaveLength(18);
    expect(Object.keys(config.botConfig.timer)).toHaveLength(14);
    expect(Object.keys(config.timerConfig.labels)).toHaveLength(7);
  });
});
