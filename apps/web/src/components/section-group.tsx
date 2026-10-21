"use client";

// Collapsible recessed section — the "instrument" the Theme Center editors and the Bot
// settings page are built from: a console-label header with a chevron, an optional icon,
// trailing slot and menu, and a panel. ONE implementation, so the trigger styling and the chevron
// rotation can't drift between pages.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function SectionGroup({
  title,
  titleId,
  icon,
  trailing,
  menu,
  summary,
  defaultOpen = true,
  open,
  onOpenChange,
  flush = false,
  className,
  children,
}: {
  title: ReactNode;
  /** id for the title text, so a list inside can point `aria-labelledby` at it. */
  titleId?: string;
  icon?: ReactNode;
  /** Renders at the right edge, before the chevron: a count, a status chip. */
  trailing?: ReactNode;
  /**
   * Actions beside the header (a dropdown menu). Rendered outside the toggle button, since a
   * button can't hold another one; `trailing` sits inside it and is display-only.
   */
  menu?: ReactNode;
  /** A one-line digest under the title, shown only while the section is collapsed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state (with `onOpenChange`), for a section that must open itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Content without the default padding, for lists that draw their own rows. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className={cn("panel-inset overflow-hidden", className)}
    >
      <div className="flex items-center">
        <CollapsibleTrigger className="group/section flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left pointer-coarse:min-h-11 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="flex min-w-0 items-center gap-2">
            {icon}
            <span className="flex min-w-0 flex-col gap-1">
              <span
                id={titleId}
                className="console-label transition-colors group-hover/section:text-foreground"
              >
                {title}
              </span>
              {summary != null && (
                <span className="font-mono text-xs text-foreground/80 tabular-nums group-data-[panel-open]/section:hidden">
                  {summary}
                </span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {trailing}
            <ChevronDown
              aria-hidden
              className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]/section:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
        {menu && <div className="shrink-0 pr-1.5">{menu}</div>}
      </div>
      <CollapsibleContent>
        <div className={flush ? "border-t border-border/40" : "space-y-3 px-4 pt-1.5 pb-4"}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
