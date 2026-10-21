"use client";

// Read-only command legend shown beside the reply editor on each command tab of the bot
// settings page, and in the Moderation card. The rows live in lib/command-rows.ts (shared
// with the viewer landing page); the bot's real parsing lives in
// `@dirework/api/chat-commands`, and apps/web/src/lib/__tests__/command-rows.test.ts pins
// the two together.

import { useId } from "react";

import type { CommandRow } from "@/lib/command-rows";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/count-badge";
import { SectionGroup } from "@/components/section-group";
import { StatusChip } from "@/components/status-chip";

/**
 * Collapsible legend of a tab's commands. Open by default; `disabled` dims the rows and
 * chips the header so a switched-off group is visible where the commands are listed, not
 * only at the switch. Mod-only rows carry a "Mods" chip, explained by a legend line under
 * the list. `title` names a second legend in the same tab (the Task tab's "Always on").
 */
export function CommandReference({
  commands,
  title = "Command reference",
  disabled = false,
  className,
}: {
  commands: CommandRow[];
  title?: string;
  disabled?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const hasModRows = commands.some((cmd) => cmd.permission === "mods");
  return (
    <SectionGroup
      title={title}
      titleId={headingId}
      trailing={
        <>
          {disabled && <StatusChip tone="idle" size="sm" label="Off" />}
          <CountBadge count={commands.length} />
        </>
      }
      flush
      className={className}
    >
      <ul
        aria-labelledby={headingId}
        className={cn("divide-y divide-border/40", disabled && "opacity-60")}
      >
        {commands.map((cmd) => (
          <li key={cmd.command} className="space-y-0.5 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="font-mono text-xs font-medium text-foreground">{cmd.command}</code>
              <span className="text-xs text-muted-foreground">{cmd.description}</span>
              {cmd.permission === "mods" && <StatusChip tone="alt" size="sm" label="Mods" />}
            </div>
            <code className="block font-mono text-2xs text-muted-foreground">{cmd.usage}</code>
          </li>
        ))}
      </ul>
      {hasModRows && (
        <p className="border-t border-border/40 px-3 py-2 text-2xs text-muted-foreground">
          Mods = moderators and the streamer.
        </p>
      )}
    </SectionGroup>
  );
}
