import { describe, expect, it } from "vitest";

import { buildTimerConfig, buildTimerStylesConfig, buildTaskStylesConfig, buildBotConfig } from "../config";

describe("buildTimerConfig", () => {
  const fakeTimerConfig = {
    id: "test",
    userId: "user1",
    workDuration: 1500000,
    breakDuration: 300000,
    longBreakDuration: 900000,
    longBreakInterval: 4,
    startingDuration: 5000,
    defaultCycles: 4,
    showHours: false,
    noLastBreak: true,
    labelIdle: "Ready",
    labelStarting: "Starting",
    labelWork: "Focus",
    labelBreak: "Break",
    labelLongBreak: "Long Break",
    labelPaused: "Paused",
    labelFinished: "Done",
  };

  it("should build nested timerConfig with labels sub-object", () => {
    const result = buildTimerConfig(fakeTimerConfig);
    expect(result.workDuration).toBe(1500000);
    expect(result.breakDuration).toBe(300000);
    expect(result.defaultCycles).toBe(4);
    expect(result.labels.idle).toBe("Ready");
    expect(result.labels.work).toBe("Focus");
    expect(result.labels.finished).toBe("Done");
    expect(Object.keys(result.labels)).toHaveLength(7);
  });

  it("should have all 7 phase label keys", () => {
    const result = buildTimerConfig(fakeTimerConfig);
    expect(result.labels).toHaveProperty("idle");
    expect(result.labels).toHaveProperty("starting");
    expect(result.labels).toHaveProperty("work");
    expect(result.labels).toHaveProperty("break");
    expect(result.labels).toHaveProperty("longBreak");
    expect(result.labels).toHaveProperty("paused");
    expect(result.labels).toHaveProperty("finished");
  });
});

describe("buildTimerStylesConfig", () => {
  const fakeTimerStyle = {
    id: "test",
    userId: "user1",
    width: "280px",
    height: "280px",
    bgColor: "#1a1a1a",
    bgOpacity: 0.95,
    bgBorderRadius: "22%",
    ringEnabled: true,
    ringTrackColor: "#333333",
    ringTrackOpacity: 0.6,
    ringFillColor: "#ffffff",
    ringFillOpacity: 1.0,
    ringWidth: 6,
    ringGap: 8,
    textColor: "#ffffff",
    textOutlineColor: "#000000",
    textOutlineSize: "0px",
    textFontFamily: "Montserrat",
    fontSizeLabel: "13px",
    fontSizeTime: "48px",
    fontSizeCycle: "12px",
  };

  it("should build nested timerStyles object", () => {
    const result = buildTimerStylesConfig(fakeTimerStyle);
    expect(result.dimensions.width).toBe("280px");
    expect(result.background.color).toBe("#1a1a1a");
    expect(result.ring.enabled).toBe(true);
    expect(result.ring.width).toBe(6);
    expect(result.text.fontFamily).toBe("Montserrat");
    expect(result.fontSizes.time).toBe("48px");
  });
});

describe("buildTaskStylesConfig", () => {
  const fakeTaskStyle = {
    id: "test",
    userId: "user1",
    displayShowDone: true,
    displayShowCount: true,
    displayUseCheckboxes: true,
    displayCrossOnDone: true,
    displayNumberOfLines: 2,
    fontHeader: "Montserrat",
    fontBody: "Roboto",
    scrollEnabled: true,
    scrollPixelsPerSecond: 70,
    scrollGapBetweenLoops: 100,
    headerHeight: "45px",
    headerBgColor: "#1a1a1a",
    headerBgOpacity: 0.95,
    headerBorderColor: "#333",
    headerBorderWidth: "1px",
    headerBorderRadius: "10px 10px 0 0",
    headerFontSize: "18px",
    headerFontColor: "#ffffff",
    headerPadding: "0 14px",
    bodyBgColor: "#1a1a1a",
    bodyBgOpacity: 0.9,
    bodyBorderColor: "#333",
    bodyBorderWidth: "1px",
    bodyBorderRadius: "0 0 10px 10px",
    bodyPaddingVertical: "8px",
    bodyPaddingHorizontal: "8px",
    taskBgColor: "#2a2a2a",
    taskBgOpacity: 0.8,
    taskBorderColor: "#444",
    taskBorderWidth: "1px",
    taskBorderRadius: "8px",
    taskFontSize: "15px",
    taskFontColor: "#e0e0e0",
    taskUsernameColor: "#ffffff",
    taskPadding: "8px 10px",
    taskMarginBottom: "4px",
    taskMaxWidth: "100%",
    taskDoneBgColor: "#1a1a1a",
    taskDoneBgOpacity: 0.6,
    taskDoneFontColor: "#888888",
    checkboxSize: "18px",
    checkboxBgColor: "transparent",
    checkboxBgOpacity: 0,
    checkboxBorderColor: "#666",
    checkboxBorderWidth: "2px",
    checkboxBorderRadius: "4px",
    checkboxMarginTop: "1px",
    checkboxMarginLeft: "0px",
    checkboxMarginRight: "8px",
    checkboxTickChar: "✓",
    checkboxTickSize: "12px",
    checkboxTickColor: "#4ade80",
    bulletChar: "•",
    bulletSize: "16px",
    bulletColor: "#888",
    bulletMarginTop: "0px",
    bulletMarginLeft: "2px",
    bulletMarginRight: "8px",
  };

  it("should build nested taskStyles object with scroll.enabled", () => {
    const result = buildTaskStylesConfig(fakeTaskStyle);
    expect(result.display.showDone).toBe(true);
    expect(result.scroll.enabled).toBe(true);
    expect(result.scroll.pixelsPerSecond).toBe(70);
    expect(result.task.usernameColor).toBe("#ffffff");
    expect(result.checkbox.tickChar).toBe("✓");
    expect(result.bullet.char).toBe("•");
  });

  it("should not include a direction field in task", () => {
    const result = buildTaskStylesConfig(fakeTaskStyle);
    expect(result.task).not.toHaveProperty("direction");
  });
});

describe("buildBotConfig", () => {
  const fakeBotConfig = {
    id: "test",
    userId: "user1",
    taskCommandsEnabled: true,
    timerCommandsEnabled: false,
    commandAliases: { "!t": "!task" },
    msgTaskAdded: "a",
    msgNoTaskAdded: "b",
    msgNoTaskContent: "c",
    msgNoTaskToEdit: "d",
    msgTaskEdited: "e",
    msgTaskRemoved: "f",
    msgTaskNext: "g",
    msgAdminDeleteTasks: "h",
    msgTaskDone: "i",
    msgTaskCheck: "j",
    msgTaskCheckUser: "k",
    msgNoTask: "l",
    msgNoTaskOther: "m",
    msgNotMod: "n",
    msgClearedAll: "o",
    msgClearedDone: "p",
    msgNextNoContent: "q",
    msgHelp: "r",
    msgWorkMsg: "w1",
    msgBreakMsg: "w2",
    msgLongBreakMsg: "w3",
    msgWorkRemindMsg: "w4",
    msgNotRunning: "w5",
    msgStreamStarting: "w6",
    msgWrongCommand: "w7",
    msgTimerRunning: "w8",
    msgCommandSuccess: "w9",
    msgCycleWrong: "w10",
    msgGoalWrong: "w11",
    msgFinishResponse: "w12",
    msgAlreadyStarting: "w13",
    msgEta: "w14",
  };

  it("should build nested botConfig with task and timer message groups", () => {
    const result = buildBotConfig(fakeBotConfig);
    expect(result.taskCommandsEnabled).toBe(true);
    expect(result.timerCommandsEnabled).toBe(false);
    expect(result.commandAliases).toEqual({ "!t": "!task" });
    expect(result.task.taskAdded).toBe("a");
    expect(result.task.help).toBe("r");
    expect(Object.keys(result.task)).toHaveLength(18);
    expect(result.timer.workMsg).toBe("w1");
    expect(result.timer.eta).toBe("w14");
    expect(Object.keys(result.timer)).toHaveLength(14);
  });
});
