// "How will you run the bot?" — the choice the setup checklist's bot step and Bot settings'
// "Run the bot" card both show (components/bot-page-handoff.tsx), as data. Pure (no React) so
// the copy and the stored-choice helpers are unit-tested. One bot page token, two views
// (lib/bot-view.ts): the owner picks one and sees only that URL and its own steps.

import { readPref, writePref, type PrefStorage } from "@/lib/browser-storage";
import type { BotView } from "@/lib/bot-view";

export interface BotRunMode {
  view: BotView;
  /** The option's name. */
  title: string;
  /** The option's sub-label: where it runs and what it shows. */
  hint: string;
  /** Names the URL row: "<urlLabel> URL" is its visible label and every accessible name. */
  urlLabel: string;
  /** What to do with the URL, in order. */
  steps: readonly string[];
}

export const BOT_RUN_MODES = [
  {
    view: "widget",
    title: "Widget",
    hint: "OBS browser source or Moblin widget · invisible on stream",
    urlLabel: "Widget",
    steps: [
      "In OBS add a Browser source, or in Moblin a Browser widget, and paste the widget URL.",
      "Any size works and it can sit anywhere on the canvas: it never draws anything.",
      'In OBS, untick "Shutdown source when not visible". In Moblin, keep it in a scene that stays loaded.',
    ],
  },
  {
    view: "dock",
    title: "Dock / browser tab",
    hint: "Controls and status · OBS custom browser dock or a pinned tab",
    urlLabel: "Dock",
    steps: [
      "In OBS, open Docks → Custom Browser Docks, paste the dock URL and click Apply. No OBS? Open it in a browser tab and pin the tab.",
      "It shows the bot's status, its last error and buttons for the timer and mute.",
      "Tab it behind another dock if it's in the way, but don't close it: closing it stops the bot.",
    ],
  },
] as const satisfies readonly BotRunMode[];

/** Shown until the owner picks: the widget works everywhere, phones included. */
export const DEFAULT_BOT_VIEW: BotView = "widget";

/** The option for `view`. */
export function botRunMode(view: BotView): BotRunMode {
  return BOT_RUN_MODES.find((mode) => mode.view === view) ?? BOT_RUN_MODES[0];
}

/** localStorage key for the owner's pick, shared by the checklist and the card. */
export const BOT_VIEW_KEY = "dirework.bot-view";

/** The stored pick, or null when absent, unknown or storage is unavailable. */
export function readBotView(storage: PrefStorage | null): BotView | null {
  const stored = readPref(storage, BOT_VIEW_KEY);
  return BOT_RUN_MODES.some((mode) => mode.view === stored) ? (stored as BotView) : null;
}

/** Persist the pick, best-effort: false when storage is missing or throws. */
export function writeBotView(storage: PrefStorage | null, view: BotView): boolean {
  return writePref(storage, BOT_VIEW_KEY, view);
}
