import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SETUP_STEPS,
  STEP_STATE_LABELS,
  captureAllDoneAtLoad,
  isSetupCollapsed,
  shouldRefreshMeAfterConfirm,
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
  it("rolls back only the step's flag, keeping fields that changed meanwhile", () => {
    const snapshot = { ...me(true), overlayTimerToken: "old-token" };
    const optimistic = withSetupStep(snapshot, "timerOverlay", true);
    // Meanwhile an overlay-URL reset refetched user.me with a rotated token.
    const refetched = { ...optimistic, overlayTimerToken: "rotated-token" };
    const rolledBack = withSetupStep(refetched, "timerOverlay", snapshot.setup.timerOverlay);
    expect(rolledBack.setup.timerOverlay).toBe(false);
    expect(rolledBack.overlayTimerToken).toBe("rotated-token");
  });

  it("the failed-confirm handler patches the flag, never restores the whole snapshot", () => {
    const src = readFileSync(
      path.resolve(import.meta.dirname, "../../components/setup-checklist.tsx"),
      "utf8",
    );
    expect(src).toContain("withSetupStep(current, step, previousConfirmed)");
    expect(src).not.toContain("context?.previous)");
  });

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
    // The only invalidate is the guarded one-off in onSettled; nothing cancels user.me.
    expect(src.match(/invalidateQueries/g)).toHaveLength(1);
    expect(src).toMatch(
      /shouldRefreshMeAfterConfirm\([\s\S]*?\)\s*\)\s*\{\s*void queryClient\.invalidateQueries/,
    );
    expect(src).not.toContain("cancelQueries");
    expect(src).toContain("queryClient.isFetching({ queryKey: meKey })");
  });

  it("keeps Mark as not added reachable for the bot page step without a bot account", () => {
    const noBot = src.slice(src.indexOf('if (id === "botSource" && !me.botAccount)'));
    expect(noBot.slice(0, noBot.indexOf("\n  }\n"))).toContain(
      "{me.setup.botSource && (\n          <ConfirmControls",
    );
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

describe("setup checklist focus", () => {
  const dashboard = readFileSync(
    path.resolve(import.meta.dirname, "../../app/(app)/dashboard/dashboard.tsx"),
    "utf8",
  );
  const checklist = readFileSync(
    path.resolve(import.meta.dirname, "../../components/setup-checklist.tsx"),
    "utf8",
  );

  it("moves focus only after a click, never on a hydration-driven reveal", () => {
    // The reopen focus is gated on a flag only the Setup button's click sets.
    expect(dashboard).toContain(
      "if (!setupCollapsed && reopenRequested.current) setupHeadingRef.current?.focus();",
    );
    expect(dashboard).toMatch(/onOpen=\{\(\) => \{\s*reopenRequested\.current = true;/);
    expect(dashboard).toContain("reopenRequested.current = false;");
    // The card itself no longer infers a reopen from a collapsed → open transition.
    expect(checklist).not.toContain("wasCollapsed");
    expect(checklist).not.toContain(".focus()");
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

describe("shouldRefreshMeAfterConfirm", () => {
  it("skips the refetch in the common case: the mutation returned the checklist", () => {
    expect(shouldRefreshMeAfterConfirm({ refreshInFlight: false, failed: false })).toBe(false);
  });

  it("refreshes once when a user.me fetch was in flight at click time", () => {
    // e.g. an overlay URL reset's refetch: it is not cancelled, but it may land the old flag.
    expect(shouldRefreshMeAfterConfirm({ refreshInFlight: true, failed: false })).toBe(true);
  });

  it("refreshes once when the write failed", () => {
    expect(shouldRefreshMeAfterConfirm({ refreshInFlight: false, failed: true })).toBe(true);
  });
});

// The success handler must merge only the confirmed step: a newer user.me (e.g. after an
// overlay URL reset) must keep its other flags.
describe("confirmation success merges one flag", () => {
  it("the component patches a single step from the response instead of replacing setup", () => {
    const source = readFileSync(
      path.join(__dirname, "../../components/setup-checklist.tsx"),
      "utf8",
    );
    // A late success response must not write the cache at all: the optimistic patch already
    // holds the clicked value and newer state (a same-step URL reset) must win.
    expect(source).not.toContain("onSuccess");
    expect(source).not.toContain("{ ...old, setup }");
  });
});

// Completing the last step must not unmount the button the keyboard user just pressed.
describe("steps stay visible after the final confirmation", () => {
  it("keeps the step list once it was shown during the visit", () => {
    const source = readFileSync(
      path.join(__dirname, "../../components/setup-checklist.tsx"),
      "utf8",
    );
    expect(source).toContain("const stepsVisible = !allDone || showSteps || startedIncomplete;");
  });
});

describe("shouldRefreshMeAfterConfirm covers every ordering", () => {
  it("refetches when a fetch is running as the write settles", () => {
    expect(
      shouldRefreshMeAfterConfirm({ refreshInFlight: false, failed: false, fetchingNow: true }),
    ).toBe(true);
  });
  it("refetches when the cache disagrees with the server's answer", () => {
    expect(
      shouldRefreshMeAfterConfirm({
        refreshInFlight: false,
        failed: false,
        cachedFlag: false,
        serverFlag: true,
      }),
    ).toBe(true);
  });
  it("stays quiet when nothing overlapped and the cache matches", () => {
    expect(
      shouldRefreshMeAfterConfirm({
        refreshInFlight: false,
        failed: false,
        fetchingNow: false,
        cachedFlag: true,
        serverFlag: true,
      }),
    ).toBe(false);
  });
});
