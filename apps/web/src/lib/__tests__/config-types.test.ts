import { describe, expect, it } from "vitest";

import {
  extractTaskMessages,
  extractTimerMessages,
  extractPhaseLabels,
} from "../config-types";

describe("extractTaskMessages", () => {
  it("should extract all 18 task message fields from flat config", () => {
    const config = {
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
    };

    const result = extractTaskMessages(config);

    expect(result.taskAdded).toBe("a");
    expect(result.noTaskAdded).toBe("b");
    expect(result.noTaskContent).toBe("c");
    expect(result.noTaskToEdit).toBe("d");
    expect(result.taskEdited).toBe("e");
    expect(result.taskRemoved).toBe("f");
    expect(result.taskNext).toBe("g");
    expect(result.adminDeleteTasks).toBe("h");
    expect(result.taskDone).toBe("i");
    expect(result.taskCheck).toBe("j");
    expect(result.taskCheckUser).toBe("k");
    expect(result.noTask).toBe("l");
    expect(result.noTaskOther).toBe("m");
    expect(result.notMod).toBe("n");
    expect(result.clearedAll).toBe("o");
    expect(result.clearedDone).toBe("p");
    expect(result.nextNoContent).toBe("q");
    expect(result.help).toBe("r");
    expect(Object.keys(result)).toHaveLength(18);
  });
});

describe("extractTimerMessages", () => {
  it("should extract all 14 timer message fields from flat config", () => {
    const config = {
      msgWorkMsg: "a",
      msgBreakMsg: "b",
      msgLongBreakMsg: "c",
      msgWorkRemindMsg: "d",
      msgNotRunning: "e",
      msgStreamStarting: "f",
      msgWrongCommand: "g",
      msgTimerRunning: "h",
      msgCommandSuccess: "i",
      msgCycleWrong: "j",
      msgGoalWrong: "k",
      msgFinishResponse: "l",
      msgAlreadyStarting: "m",
      msgEta: "n",
    };

    const result = extractTimerMessages(config);

    expect(result.workMsg).toBe("a");
    expect(result.breakMsg).toBe("b");
    expect(result.longBreakMsg).toBe("c");
    expect(result.workRemindMsg).toBe("d");
    expect(result.notRunning).toBe("e");
    expect(result.streamStarting).toBe("f");
    expect(result.wrongCommand).toBe("g");
    expect(result.timerRunning).toBe("h");
    expect(result.commandSuccess).toBe("i");
    expect(result.cycleWrong).toBe("j");
    expect(result.goalWrong).toBe("k");
    expect(result.finishResponse).toBe("l");
    expect(result.alreadyStarting).toBe("m");
    expect(result.eta).toBe("n");
    expect(Object.keys(result)).toHaveLength(14);
  });
});

describe("extractPhaseLabels", () => {
  it("should extract all 7 phase label fields from flat config", () => {
    const config = {
      labelIdle: "Ready",
      labelStarting: "Starting",
      labelWork: "Focus",
      labelBreak: "Break",
      labelLongBreak: "Long Break",
      labelPaused: "Paused",
      labelFinished: "Done",
    };

    const result = extractPhaseLabels(config);

    expect(result.idle).toBe("Ready");
    expect(result.starting).toBe("Starting");
    expect(result.work).toBe("Focus");
    expect(result.break).toBe("Break");
    expect(result.longBreak).toBe("Long Break");
    expect(result.paused).toBe("Paused");
    expect(result.finished).toBe("Done");
    expect(Object.keys(result)).toHaveLength(7);
  });
});
