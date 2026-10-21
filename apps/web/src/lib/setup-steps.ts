// The dashboard's "Set up streaming" checklist, as data. Pure (no React, no fetches) so the
// progress math and the copy are unit-tested. Step 1 is detected from `user.me` (a bot
// account row exists); steps 2-4 are what the owner confirmed with a click. Nothing here is
// ever inferred from overlay or bot-page traffic: that would need a write on a poll path.

import type { SetupStep } from "@dirework/api/routers/input-schemas";

/** The slice of `user.me` the checklist reads. */
export interface SetupSource {
  botAccount: unknown;
  setup: Record<SetupStep, boolean>;
}

export type SetupStepId = "botAccount" | SetupStep;

/** How a step becomes done: detected from data, or confirmed by the owner. */
export type SetupStepKind = "detected" | "confirmed";

export interface SetupStepDef {
  id: SetupStepId;
  kind: SetupStepKind;
  title: string;
  /** One line on why the step matters. */
  why: string;
  /** What to do, shown above the handoff. */
  action: string;
}

export const SETUP_STEPS = [
  {
    id: "botAccount",
    kind: "detected",
    title: "Connect the bot account",
    why: "The bot is the Twitch account that reads chat commands and replies in your channel.",
    action: "Sign in to Twitch as the bot on the Bot settings page.",
  },
  {
    id: "botSource",
    kind: "confirmed",
    title: "Add the bot page to OBS",
    why: "The bot only chats while its page is open, so OBS keeps it running all stream.",
    action: "Copy the bot page URL into a new OBS browser source, about 400 × 200.",
  },
  {
    id: "timerOverlay",
    kind: "confirmed",
    title: "Add the timer overlay",
    why: "Viewers see the focus timer you run from this dashboard.",
    action: "Copy the timer overlay URL into a new OBS browser source, 300 × 300.",
  },
  {
    id: "tasksOverlay",
    kind: "confirmed",
    title: "Add the tasks overlay",
    why: "Viewers see your tasks and the ones chat adds with !task.",
    action: "Copy the tasks overlay URL into a new OBS browser source, 700 × 800.",
  },
] as const satisfies readonly SetupStepDef[];

export type SetupStepState = "done" | "confirmed" | "todo";

/** `done` for a detected step, `confirmed` for an owner-confirmed one, else `todo`. */
export function stepState(me: SetupSource, id: SetupStepId): SetupStepState {
  if (id === "botAccount") return me.botAccount ? "done" : "todo";
  return me.setup[id] ? "confirmed" : "todo";
}

/** Chip label for each step state. */
export const STEP_STATE_LABELS: Record<SetupStepState, string> = {
  done: "Done",
  confirmed: "Added (you confirmed)",
  todo: "Not yet",
};

export interface SetupProgress {
  done: number;
  total: number;
  /** The first step still to do, in order; null once every step is done. */
  nextStep: SetupStepId | null;
}

export function setupProgress(me: SetupSource): SetupProgress {
  let done = 0;
  let nextStep: SetupStepId | null = null;
  for (const step of SETUP_STEPS) {
    if (stepState(me, step.id) === "todo") nextStep ??= step.id;
    else done += 1;
  }
  return { done, total: SETUP_STEPS.length, nextStep };
}

/**
 * `user.me` with one step's flag patched — the optimistic update and its rollback. Only
 * `setup[step]` changes, so fields refetched meanwhile (a rotated overlay token) survive.
 */
export function withSetupStep<T extends SetupSource>(
  me: T,
  step: SetupStep,
  confirmed: boolean,
): T {
  return { ...me, setup: { ...me.setup, [step]: confirmed } };
}

/**
 * Whether a settled confirmation must refetch `user.me` (once). Normally no: the mutation
 * returns the checklist and the cache is patched. Yes when a `user.me` fetch was already in
 * flight at click time (it may land the old flag — and it is never cancelled, since it may
 * carry a rotated overlay token), or when the write failed (server state unknown).
 */
export function shouldRefreshMeAfterConfirm({
  refreshInFlight,
  failed,
}: {
  refreshInFlight: boolean;
  failed: boolean;
}): boolean {
  return refreshInFlight || failed;
}

/** localStorage key for "Finish later": "1" = collapsed, "0" = open, absent = default. */
export const SETUP_COLLAPSED_KEY = "dirework.setup-collapsed";

/** The slice of Storage the helpers use, so tests can pass a throwing fake. */
export type SetupStorage = Pick<Storage, "getItem" | "setItem">;

/** The stored "Finish later" choice, or null when absent or storage is unavailable. */
export function readSetupCollapsed(storage: SetupStorage | null): string | null {
  try {
    return storage?.getItem(SETUP_COLLAPSED_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist the choice, best-effort: returns false when storage is missing or throws (private
 * mode, blocked site data). The caller's in-memory state stays the source of truth.
 */
export function writeSetupCollapsed(storage: SetupStorage | null, collapsed: boolean): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETUP_COLLAPSED_KEY, collapsed ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/**
 * The "all done when the dashboard loaded" fact behind the collapse default, captured once:
 * `undefined` until `user.me` has loaded (a failed SSR prefetch leaves it undefined on the
 * first render), then the first known value, which later changes never overwrite — so
 * finishing the last step in this visit keeps the card open.
 */
export function captureAllDoneAtLoad(
  captured: boolean | undefined,
  allDone: boolean | undefined,
): boolean | undefined {
  return captured ?? allDone;
}

/**
 * Whether the card is collapsed: the owner's stored choice wins; with none, it stays open
 * until every step is done.
 */
export function isSetupCollapsed(stored: string | null, allDone: boolean): boolean {
  if (stored === "1") return true;
  if (stored === "0") return false;
  return allDone;
}
