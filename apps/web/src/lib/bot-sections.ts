// The Bot settings sub-pages (/dashboard/bot/*), in sub-nav order. Pure, so the nav's
// active-section rule is unit-tested and the e2e specs and the nav share one list.

import type { Route } from "next";

export interface BotSection {
  href: Route;
  label: string;
}

export const BOT_SECTIONS: readonly BotSection[] = [
  { href: "/dashboard/bot", label: "Overview" },
  { href: "/dashboard/bot/commands", label: "Commands" },
  { href: "/dashboard/bot/replies", label: "Replies" },
  { href: "/dashboard/bot/moderation", label: "Moderation" },
];

/**
 * The section a pathname belongs to: an exact match, or the deepest section the path sits
 * under (Overview is the parent of every other one, so it only wins on its own path).
 * Null outside Bot settings.
 */
export function activeBotSection(pathname: string): BotSection | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let match: BotSection | null = null;
  for (const section of BOT_SECTIONS) {
    if (path === section.href || path.startsWith(`${section.href}/`)) {
      if (!match || section.href.length > match.href.length) match = section;
    }
  }
  return match;
}
