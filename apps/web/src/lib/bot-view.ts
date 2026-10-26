// Which layout the bot page renders. Pure (no React) so the parsing and the feed filters are
// unit-tested. The default view is the widget: a blank, transparent page that runs the bot
// and paints nothing, so it can sit on any OBS or Moblin scene (it only says its state in
// the tab title and to screen readers). `?view=dock` is the visible control panel, for an OBS
// custom browser dock (Docks → Custom Browser Docks) or a pinned browser tab. Both views run
// the same bot session: the layout changes, the requests do not.

import type { BotActivityKind } from "@/lib/bot-session";

export type BotView = "widget" | "dock";

/** The query value that selects the dock layout. */
export const BOT_DOCK_VIEW = "dock";

/** `?view=dock` (case-insensitive, first value wins) selects the dock; anything else, the widget. */
export function parseBotView(value: string | string[] | undefined): BotView {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim().toLowerCase() === BOT_DOCK_VIEW ? "dock" : "widget";
}

/** Path of the bot page, in the default (blank widget) layout or the dock layout. */
export function botPagePath(token: string, view: BotView = "widget"): string {
  const path = `/bot/${token}`;
  return view === "dock" ? `${path}?view=${BOT_DOCK_VIEW}` : path;
}

/** The tab title: the page's only visible state when it is the blank widget. */
export function botPageTitle(status: string): string {
  return `DireWork bot · ${status}`;
}

export interface BotActivityLine {
  id: number;
  time: string;
  kind: BotActivityKind;
  text: string;
}

/**
 * The dock's "recent commands" list: relayed command lines and the bot's replies, newest
 * first, at most `limit`. Info and error lines are left out — errors get their own panel.
 */
export function recentCommandLines(
  activity: readonly BotActivityLine[],
  limit: number,
): BotActivityLine[] {
  const out: BotActivityLine[] = [];
  for (let i = activity.length - 1; i >= 0 && out.length < limit; i--) {
    const line = activity[i];
    if (line && (line.kind === "chat" || line.kind === "reply")) out.push(line);
  }
  return out;
}
