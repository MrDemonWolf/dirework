"use client";

// Read-only command legend shown beside the reply editor on each command tab of the bot
// settings page. Display-only documentation: the bot's real parsing lives in
// `@dirework/api/chat-commands`, so the rows are kept in step by hand and pinned by
// apps/web/src/lib/__tests__/command-rows.test.ts.

import { useId } from "react";

import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/count-badge";
import { SectionGroup } from "@/components/section-group";
import { StatusChip } from "@/components/status-chip";

/** One row of the command reference. */
export interface CommandRow {
  command: string;
  usage: string;
  description: string;
}

/** Reference rows for the Task tab. */
export const taskCommands: CommandRow[] = [
  { command: "!task", usage: "!task [task]", description: "Add a task" },
  { command: "!done", usage: "!done or !done [#]", description: "Mark a task done" },
  { command: "!edit", usage: "!edit [#] [new task]", description: "Edit a task" },
  { command: "!remove", usage: "!remove [#]", description: "Remove a task" },
  { command: "!focus", usage: "!focus [#]", description: "Set your active task" },
  { command: "!check", usage: "!check or !check @user", description: "Show your current task" },
  { command: "!today", usage: "!today", description: "Show your focus and next tasks" },
  {
    command: "!next",
    usage: "!next [task]",
    description: "Finish the current task and start the next",
  },
  { command: "!help", usage: "!help", description: "Show help in chat" },
  { command: "!clear", usage: "!clear all/done/@user", description: "Clear tasks (mods only)" },
];

/** Reference rows for the Timer tab. */
export const timerCommands: CommandRow[] = [
  { command: "!timer start", usage: "!timer start [cycles]", description: "Start the timer" },
  { command: "!timer pause", usage: "!timer pause", description: "Pause the timer" },
  { command: "!timer resume", usage: "!timer resume", description: "Resume the timer" },
  { command: "!timer skip", usage: "!timer skip", description: "Skip the current phase" },
  { command: "!timer reset", usage: "!timer reset", description: "Stop and reset the timer" },
  { command: "!timer eta", usage: "!timer eta", description: "Show when the timer ends" },
];

/**
 * Collapsible legend of a tab's commands. Open by default; `disabled` dims the rows and
 * chips the header so a switched-off group is visible where the commands are listed, not
 * only at the switch.
 */
export function CommandReference({
  commands,
  disabled = false,
  className,
}: {
  commands: CommandRow[];
  disabled?: boolean;
  className?: string;
}) {
  const headingId = useId();
  return (
    <SectionGroup
      title="Command reference"
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
            <div className="flex flex-wrap items-baseline gap-x-2">
              <code className="font-mono text-xs font-medium text-foreground">{cmd.command}</code>
              <span className="text-xs text-muted-foreground">{cmd.description}</span>
            </div>
            <code className="block font-mono text-[11px] text-muted-foreground/80">
              {cmd.usage}
            </code>
          </li>
        ))}
      </ul>
    </SectionGroup>
  );
}
