import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  LEGACY_PHASE_LABELS,
  LEGACY_TASK_MESSAGES,
  LEGACY_TIMER_MESSAGES,
  PHASE_LABEL_COLUMN_DEFAULTS,
  TASK_MESSAGE_COLUMN_DEFAULTS,
  TIMER_MESSAGE_COLUMN_DEFAULTS,
  TIMER_STATUSES,
} from "../defaults";

const sortedKeys = (record: Record<string, unknown>) => Object.keys(record).sort();

// The bot reply defaults are three records per group that must agree key for
// key: the frozen bot_config column defaults, the wording the app sends today,
// and the earlier wordings `buildBotConfig` upgrades on read. A drift between
// them is a reply that either cannot be stored or never reaches chat.
describe.each([
  {
    group: "task",
    current: DEFAULT_TASK_MESSAGES as Record<string, string>,
    column: TASK_MESSAGE_COLUMN_DEFAULTS as Record<string, string>,
    legacy: LEGACY_TASK_MESSAGES as Record<string, readonly string[]>,
  },
  {
    group: "timer",
    current: DEFAULT_TIMER_MESSAGES as Record<string, string>,
    column: TIMER_MESSAGE_COLUMN_DEFAULTS as Record<string, string>,
    legacy: LEGACY_TIMER_MESSAGES as Record<string, readonly string[]>,
  },
])("$group message defaults", ({ current, column, legacy }) => {
  it("keeps the column defaults, the current wording and the legacy list on the same keys", () => {
    expect(sortedKeys(column)).toEqual(sortedKeys(current));
    expect(sortedKeys(legacy)).toEqual(sortedKeys(current));
  });

  it("lists as legacy only wordings that differ from the current and column defaults", () => {
    // A legacy entry equal to the current default would upgrade to itself, and
    // one equal to the column default is already covered by the column default.
    for (const [key, wordings] of Object.entries(legacy)) {
      for (const wording of wordings) {
        expect(wording, key).not.toBe(current[key]);
        expect(wording, key).not.toBe(column[key]);
      }
      expect(new Set(wordings).size, key).toBe(wordings.length);
    }
  });

  it("never ships an empty reply or one IRC would read as a command", () => {
    for (const record of [column, current]) {
      for (const [key, wording] of Object.entries(record)) {
        expect(wording.trim(), key).not.toBe("");
        // `/` and `.` are Twitch chat command prefixes; `!` would trigger other bots.
        expect(wording, key).not.toMatch(/^[!/.]/);
      }
    }
  });
});

describe("phase labels", () => {
  it("names every timer status with a non-empty label, and nothing else", () => {
    expect(sortedKeys(DEFAULT_PHASE_LABELS)).toEqual([...TIMER_STATUSES].sort());
    for (const [status, label] of Object.entries(DEFAULT_PHASE_LABELS)) {
      expect(label.trim(), status).not.toBe("");
    }
  });

  it("the frozen column defaults and legacy lists cover the same phases, never the current label", () => {
    expect(sortedKeys(PHASE_LABEL_COLUMN_DEFAULTS)).toEqual(sortedKeys(DEFAULT_PHASE_LABELS));
    expect(sortedKeys(LEGACY_PHASE_LABELS)).toEqual(sortedKeys(DEFAULT_PHASE_LABELS));
    for (const [status, labels] of Object.entries(LEGACY_PHASE_LABELS)) {
      expect(labels, status).not.toContain(
        DEFAULT_PHASE_LABELS[status as keyof typeof DEFAULT_PHASE_LABELS],
      );
    }
  });
});
