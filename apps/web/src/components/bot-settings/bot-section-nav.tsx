"use client";

// Sticky link bar under the Bot settings heading: one link per sub-page (lib/bot-sections.ts),
// the current one marked with aria-current. Plain links, not tabs: each section is its own
// URL, so Back, refresh and bookmarks work. No prefetch: a hover must never spend a request.
// A page with unsaved edits guards these links like any other (UnsavedChangesGuard).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeBotSection, BOT_SECTIONS } from "@/lib/bot-sections";
import { cn } from "@/lib/utils";

export function BotSectionNav() {
  const active = activeBotSection(usePathname());
  return (
    <nav
      aria-label="Bot settings sections"
      className="sticky top-header z-(--z-save-bar) -mx-4 mb-6 border-b border-border/60 bg-background/90 px-4 backdrop-blur-2xl"
    >
      {/* Scrolls sideways on a narrow phone instead of wrapping. */}
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {BOT_SECTIONS.map((section) => {
          const current = active?.href === section.href;
          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
