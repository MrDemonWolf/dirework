import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SETUP_STEPS,
  STEP_STATE_LABELS,
  captureAllDoneAtLoad,
  isSetupCollapsed,
  readSetupCollapsed,
  setupProgress,
  stepState,
  withSetupStep,
  writeSetupCollapsed,
  type SetupSource,
} from "../setup-steps";

const me = (botAccount: boolean, setup: Partial<SetupSource["setup"]> = {}): SetupSource => ({
  botAccount: botAccount ? { displayName: "DireBot" } : null,
  setup: { botSource: false, timerOverlay: false, tasksOverlay: false, ...setup },
});

describe("setupProgress", () => {
  it("starts at 0 of 4 with the bot account next", () => {
    expect(setupProgress(me(false))).toEqual({ done: 0, total: 4, nextStep: "botAccount" });
  });

  it("counts a connected bot account as done without a confirmation", () => {
    expect(setupProgress(me(true))).toEqual({ done: 1, total: 4, nextStep: "botSource" });
  });

  it("points at the first unfinished step, in order, even when later ones are done", () => {
    expect(setupProgress(me(false, { timerOverlay: true, tasksOverlay: true }))).toEqual({
      done: 2,
      total: 4,
      nextStep: "botAccount",
    });
    expect(setupProgress(me(true, { botSource: true, tasksOverlay: true })).nextStep).toBe(
      "timerOverlay",
    );
  });

  it("has no next step once all four are done", () => {
    expect(
      setupProgress(me(true, { botSource: true, timerOverlay: true, tasksOverlay: true })),
    ).toEqual({ done: 4, total: 4, nextStep: null });
  });
});

describe("stepState", () => {
  it("distinguishes detected Done from owner-confirmed Added", () => {
    const state = me(true, { timerOverlay: true });
    expect(stepState(state, "botAccount")).toBe("done");
    expect(stepState(state, "timerOverlay")).toBe("confirmed");
    expect(stepState(state, "tasksOverlay")).toBe("todo");
    expect(STEP_STATE_LABELS).toEqual({
      done: "Done",
      confirmed: "Added (you confirmed)",
      todo: "Not yet",
    });
  });
});

describe("SETUP_STEPS copy", () => {
  it("orders the four steps and gives each a title, a why and an action", () => {
    expect(SETUP_STEPS.map((s) => s.id)).toEqual([
      "botAccount",
      "botSource",
      "timerOverlay",
      "tasksOverlay",
    ]);
    for (const step of SETUP_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.why).toMatch(/\.$/);
      expect(step.action).toMatch(/\.$/);
    }
    // Only the bot account is detected; everything about OBS is the owner's word.
    expect(SETUP_STEPS.filter((s) => s.kind === "detected").map((s) => s.id)).toEqual([
      "botAccount",
    ]);
  });
});

describe("withSetupStep", () => {
  it("patches one flag and leaves the rest of user.me alone", () => {
    const before = { ...me(true), overlayTimerToken: "t" };
    const after = withSetupStep(before, "timerOverlay", true);
    expect(after.setup).toEqual({ botSource: false, timerOverlay: true, tasksOverlay: false });
    expect(after.overlayTimerToken).toBe("t");
    expect(before.setup.timerOverlay).toBe(false);
  });
});

describe("isSetupCollapsed", () => {
  it("follows the stored choice, else collapses only when everything is done", () => {
    expect(isSetupCollapsed("1", false)).toBe(true);
    expect(isSetupCollapsed("0", true)).toBe(false);
    expect(isSetupCollapsed(null, false)).toBe(false);
    expect(isSetupCollapsed(null, true)).toBe(true);
    expect(isSetupCollapsed("garbage", false)).toBe(false);
  });
});

// Source pins: the checklist is a free-tier citizen. It never polls, and a confirm patches
// the cached `user.me` instead of refetching it.
describe("setup checklist source", () => {
  const src = readFileSync(
    path.resolve(import.meta.dirname, "../../components/setup-checklist.tsx"),
    "utf8",
  );

  it("never polls", () => {
    expect(src).not.toContain("refetchInterval");
  });

  it("confirms through user.confirmSetupStep and patches the cache with setQueryData", () => {
    expect(src).toContain("trpc.user.confirmSetupStep.mutationOptions({");
    expect(src).toContain("queryClient.setQueryData(meKey");
    expect(src).not.toContain("invalidateQueries");
  });

  it("loads the bot page URL only inside the open step", () => {
    // BotPageHandoff is the only caller of getIngestInfo, and it is rendered only for an
    // open step (`{open && (...)}`).
    expect(src.match(/trpc\.bot\.getIngestInfo/g)).toHaveLength(1);
    expect(src).toContain("{open && (");
  });
});

describe("Finish later storage helpers", () => {
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };

  it("never throw when storage does, and report the write as not persisted", () => {
    expect(readSetupCollapsed(throwing)).toBeNull();
    expect(writeSetupCollapsed(throwing, true)).toBe(false);
    expect(readSetupCollapsed(null)).toBeNull();
    expect(writeSetupCollapsed(null, true)).toBe(false);
  });

  it("round-trip the choice through a working storage", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(readSetupCollapsed(storage)).toBeNull();
    expect(writeSetupCollapsed(storage, true)).toBe(true);
    expect(readSetupCollapsed(storage)).toBe("1");
    expect(isSetupCollapsed(readSetupCollapsed(storage), false)).toBe(true);
    writeSetupCollapsed(storage, false);
    expect(isSetupCollapsed(readSetupCollapsed(storage), true)).toBe(false);
  });
});

describe("setup checklist collapsed state", () => {
  const src = readFileSync(
    path.resolve(import.meta.dirname, "../../components/setup-checklist.tsx"),
    "utf8",
  );

  it("keeps the click in component state, so blocked storage can't swallow it", () => {
    expect(src).toContain("setChoice(collapsed);");
    expect(src).toContain("choice ?? isSetupCollapsed(");
  });
});

describe("empty task board", () => {
  const src = readFileSync(
    path.resolve(import.meta.dirname, "../../components/task-manager.tsx"),
    "utf8",
  );

  it("focuses the add input only from its call to action, never on load", () => {
    expect(src).toContain("onClick={focusAddInput}");
    expect(src).not.toContain("focusedEmpty");
    expect(src).not.toContain("(pointer: coarse)");
  });
});

describe("captureAllDoneAtLoad", () => {
  it("waits for user.me when it arrives after the first render", () => {
    // Failed SSR prefetch: the first render has no data.
    let captured = captureAllDoneAtLoad(undefined, undefined);
    expect(captured).toBeUndefined();
    // The client fetch lands on a fully set-up instance: collapse by default.
    captured = captureAllDoneAtLoad(captured, true);
    expect(captured).toBe(true);
    expect(isSetupCollapsed(null, captured ?? false)).toBe(true);
  });

  it("keeps the first loaded value when progress changes during the visit", () => {
    let captured = captureAllDoneAtLoad(undefined, false);
    captured = captureAllDoneAtLoad(captured, true);
    expect(captured).toBe(false);
    expect(isSetupCollapsed(null, captured ?? false)).toBe(false);
  });
});
