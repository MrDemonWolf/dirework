import { describe, expect, it } from "vitest";

import { isDireworkCommandLine } from "@dirework/api/chat-commands";
import { interpolate } from "@dirework/api/chat-text";
import { computeNextPhase } from "@dirework/api/routers/timer-logic";
import { DEMO_SESSION, type DemoChatLine, type DemoReplyTemplate } from "@dirework/overlay-kit";

import {
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  TIMER_CONFIG_DEFAULTS,
  type TimerStatus,
} from "@/lib/config-types";

/**
 * The demo session in @dirework/overlay-kit spells its bot replies out as text
 * (that package has no dependencies). These tests hold every one of them to the
 * reply the bot would really send, so the docs and share cards can never show a
 * line the bot wouldn't say.
 */

type DemoReply = Extract<DemoChatLine, { kind: "reply" }>;
type DemoCommand = Extract<DemoChatLine, { kind: "command" }>;

const replies = DEMO_SESSION.chat.filter((line): line is DemoReply => line.kind === "reply");
const commands = DEMO_SESSION.chat.filter((line): line is DemoCommand => line.kind === "command");

/** The current default wording of the template a demo reply says it is built from. */
function defaultTemplate(template: DemoReplyTemplate): string {
  return template.group === "task"
    ? DEFAULT_TASK_MESSAGES[template.key]
    : DEFAULT_TIMER_MESSAGES[template.key];
}

/**
 * Whole minutes, rounded up, as `!timer eta` prints them ("19m", "1h 19m"). Mirrors
 * `formatEtaDuration` in packages/api/src/bot/commands.ts, whose import chain reaches
 * the Workers runtime and so can't load here.
 */
function etaDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

describe("DEMO_SESSION chat", () => {
  it("has at least one command and one reply", () => {
    expect(commands.length).toBeGreaterThan(0);
    expect(replies.length).toBeGreaterThan(0);
  });

  it("uses only commands the bot page would relay", () => {
    for (const command of commands) {
      expect(isDireworkCommandLine(command.text, new Set()), command.text).toBe(true);
    }
  });

  it("says exactly what the default reply templates say", () => {
    for (const reply of replies) {
      const template = defaultTemplate(reply.template);
      expect(reply.text, `${reply.template.group}.${reply.template.key}`).toBe(
        interpolate(template, { ...reply.vars }),
      );
    }
  });

  it("covers adding a task, finishing one, an empty plan and the timer ETA", () => {
    const used = replies.map((reply) => `${reply.template.group}.${reply.template.key}`);
    expect(used).toEqual(
      expect.arrayContaining(["task.taskAdded", "task.taskDone", "task.noTask", "timer.eta"]),
    );
  });
});

describe("DEMO_SESSION timer", () => {
  it("runs on the default timer config, so the ETA math below is the bot's", () => {
    expect(DEMO_SESSION.phaseMs).toBe(TIMER_CONFIG_DEFAULTS.workDuration);
    expect(DEMO_SESSION.cycle.total).toBe(TIMER_CONFIG_DEFAULTS.defaultCycles);
  });

  it("quotes the phase and session ETA the bot computes for this point in the session", () => {
    const eta = replies.find((reply) => reply.template.group === "timer");
    expect(eta).toBeDefined();
    if (!eta) return;

    // Same walk as getTimerEta in packages/api/src/services/timer-service.ts: add up
    // every remaining phase from the current focus block until the session finishes.
    const { total } = DEMO_SESSION.cycle;
    let sessionMs = DEMO_SESSION.remainingMs;
    let status: TimerStatus = "work";
    let cycle = DEMO_SESSION.cycle.current;
    let guard = 0;
    while (status !== "finished" && cycle <= total && guard++ < 4 * total + 4) {
      const next = computeNextPhase(
        { status, currentCycle: cycle, totalCycles: total },
        TIMER_CONFIG_DEFAULTS,
      );
      if (next.nextDuration) sessionMs += next.nextDuration;
      if (next.nextStatus === status && next.nextDuration === null) break;
      status = next.nextStatus;
      cycle = next.nextCycle;
    }

    expect(eta.vars).toEqual({
      phase: etaDuration(DEMO_SESSION.remainingMs),
      time: etaDuration(sessionMs),
    });
  });
});
