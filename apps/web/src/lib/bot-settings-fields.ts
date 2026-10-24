// Maps the Bot settings save payload's validation paths (["task", "taskAdded"]) back to the
// reply field the owner sees: its label, its input id and the tab it lives on. Pure, so the
// Save bar's wording and the per-group "invalid" flags are unit-tested.

import { type MessageField, taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import type { IssueLike } from "@/lib/validation-errors";

/**
 * The Replies page's reply sets (also its switcher's tab values); the input ids are
 * `${tab}-${key}`.
 */
export type BotMessageTab = "task" | "timer";

export interface BotMessageFieldRef {
  label: string;
  /** The input's DOM id (MessageEditor renders `${idPrefix}-${key}`). */
  fieldId: string;
  tab: BotMessageTab;
}

const FIELDS: Record<BotMessageTab, readonly MessageField[]> = {
  task: taskMessageFields,
  timer: timerMessageFields,
};

/** The reply field an issue path points at, or null for anything else (aliases, toggles). */
export function botMessageFieldFor(path: readonly PropertyKey[]): BotMessageFieldRef | null {
  const [tab, key] = path;
  if ((tab !== "task" && tab !== "timer") || typeof key !== "string") return null;
  const field = FIELDS[tab].find((f) => f.key === key);
  return field ? { label: field.label, fieldId: `${tab}-${key}`, tab } : null;
}

/** Keys of one message set that the save schema rejects, for the editor's invalid flags. */
export function invalidMessageKeys(
  issues: readonly IssueLike[],
  tab: BotMessageTab,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const issue of issues) {
    const field = botMessageFieldFor(issue.path);
    if (field?.tab === tab) keys.add(String(issue.path[1]));
  }
  return keys;
}
