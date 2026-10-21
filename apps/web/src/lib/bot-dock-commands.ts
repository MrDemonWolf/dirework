// The bot dock's command buttons. Pure (no React) so the button states and the chat lines
// they send are unit-tested. Every button sends an ordinary chat command line through the
// same `bot.ingest` call chat uses, as the channel broadcaster — so the server runs the
// same command code, permission gates and enable toggles, and there is no new procedure.

export type DockCommandId =
  | "timer-start"
  | "timer-pause"
  | "timer-resume"
  | "timer-skip"
  | "timer-reset"
  | "mute"
  | "unmute"
  | "clear-done";

export interface DockCommand {
  id: DockCommandId;
  label: string;
  /** The chat line `bot.ingest` runs. */
  line: string;
  /** Destructive: the dock asks before sending it. */
  confirm?: { title: string; description: string; confirmLabel: string };
}

export const DOCK_COMMANDS: Record<DockCommandId, DockCommand> = {
  "timer-start": { id: "timer-start", label: "Start", line: "!timer start" },
  "timer-pause": { id: "timer-pause", label: "Pause", line: "!timer pause" },
  "timer-resume": { id: "timer-resume", label: "Resume", line: "!timer resume" },
  "timer-skip": { id: "timer-skip", label: "Skip", line: "!timer skip" },
  "timer-reset": {
    id: "timer-reset",
    label: "Reset",
    line: "!timer reset",
    confirm: {
      title: "Reset the timer?",
      description: "The current session and its cycle count go back to the start.",
      confirmLabel: "Reset timer",
    },
  },
  mute: { id: "mute", label: "Mute bot", line: "!mute" },
  unmute: { id: "unmute", label: "Unmute bot", line: "!unmute" },
  "clear-done": {
    id: "clear-done",
    label: "Clear done",
    line: "!clear done",
    confirm: {
      title: "Clear done tasks?",
      description: "Every finished task leaves the list and the overlay. This can't be undone.",
      confirmLabel: "Clear done",
    },
  },
};

/**
 * Timer buttons in display order. The dock doesn't poll the timer (no new requests), so it
 * can't know which of these apply: all five show, and the server answers an invalid one
 * ("not running") the same way it answers a mod in chat.
 */
export const DOCK_TIMER_COMMANDS: readonly DockCommandId[] = [
  "timer-start",
  "timer-pause",
  "timer-resume",
  "timer-skip",
  "timer-reset",
];

export interface DockControlsInput {
  /** The bot session bootstrapped (`live`) and knows the broadcaster's identity. */
  ready: boolean;
  muted: boolean;
  /** A dock command is in flight. */
  busy: boolean;
}

export interface DockControls {
  /** Mute or Unmute — whichever flips the current state. */
  muteToggle: DockCommandId;
  /** Disabled state per button. */
  disabled: Record<DockCommandId, boolean>;
  /** Why the buttons are off, for the line under them; null when they work. */
  hint: string | null;
}

/**
 * Which buttons the dock shows and enables. Everything is off until the session is live and
 * while a click is in flight (one request per click, never stacked). While muted the server
 * ignores everything but `!unmute`, so only Unmute stays on.
 */
export function dockControls({ ready, muted, busy }: DockControlsInput): DockControls {
  const off = !ready || busy;
  const disabled = {} as Record<DockCommandId, boolean>;
  for (const id of Object.keys(DOCK_COMMANDS) as DockCommandId[]) {
    disabled[id] = off || (muted && id !== "unmute");
  }
  return {
    muteToggle: muted ? "unmute" : "mute",
    disabled,
    // Muted has its own banner in the dock, so no second line here.
    hint: ready ? null : "Buttons turn on once the bot is connected.",
  };
}

export type DockCommandResult =
  | { ok: true; replies: string[] }
  | { ok: false; reason: "not-ready" | "failed" };

/** The status line after a click: the bot's reply (never posted to chat), or why not. */
export function dockResultText(result: DockCommandResult): string {
  if (!result.ok) {
    return result.reason === "not-ready"
      ? "The bot isn't connected yet. Try again in a moment."
      : "Couldn't reach DireWork. Nothing changed; try again.";
  }
  if (result.replies.length === 0) {
    // The server runs dock lines exactly like chat: a disabled command answers nothing.
    return "Sent, but the bot had no reply. That command may be turned off in Dashboard → Bot.";
  }
  return result.replies.join(" ");
}
