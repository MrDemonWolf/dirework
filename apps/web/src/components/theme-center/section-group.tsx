"use client";

import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Collapsible editor section — headers styled as mono console labels,
 * matching the Focus Console design language.
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
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="console-label flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {title}
        <ChevronDown className="size-3.5 transition-transform [[data-state=open]>&]:rotate-180 [[data-panel-open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 px-2 pt-2 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
