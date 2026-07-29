"use client";

import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Collapsible editor section — each section is its own recessed panel so the
 * editor reads as a stack of instruments instead of a wall of inputs.
 */
export function SectionGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="panel-inset overflow-hidden">
      <CollapsibleTrigger className="console-label flex w-full cursor-pointer items-center justify-between px-3 py-2.5 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {title}
        <ChevronDown className="size-3.5 transition-transform [[data-state=open]>&]:rotate-180 [[data-panel-open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 px-4 pt-1.5 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
