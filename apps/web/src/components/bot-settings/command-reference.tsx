"use client";

// Read-only command legend shown beside the reply editor on each command tab of the bot
// settings page, and in the Moderation card. Display-only documentation: the bot's real
// parsing lives in `@dirework/api/chat-commands`, so the rows are kept in step by hand and
// pinned by apps/web/src/lib/__tests__/command-rows.test.ts.

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
  /** Who can run it in chat; "mods" covers moderators and the streamer. */
  permission: "everyone" | "mods";
}

/** Reference rows for the Task tab. */
export const taskCommands: CommandRow[] = [
  { command: "!task", usage: "!task [task]", description: "Add a task", permission: "everyone" },
  {
    command: "!done",
    usage: "!done or !done [#]",
    description: "Mark a task done",
    permission: "everyone",
  },
  {
    command: "!edit",
    usage: "!edit [#] [new task]",
    description: "Edit a task",
    permission: "everyone",
  },
  {
    command: "!remove",
    usage: "!remove [#]",
    description: "Remove a task",
    permission: "everyone",
  },
  {
    command: "!focus",
    usage: "!focus [#]",
    description: "Set your active task",
    permission: "everyone",
  },
  {
    command: "!check",
    usage: "!check or !check @user",
    description: "Show your current task",
    permission: "everyone",
  },
  {
    command: "!today",
    usage: "!today",
    description: "Show your focus and next tasks",
    permission: "everyone",
  },
  {
    command: "!next",
    usage: "!next [task]",
    description: "Finish the current task and start the next",
    permission: "everyone",
  },
  { command: "!help", usage: "!help", description: "Show help in chat", permission: "everyone" },
  {
    command: "!clear",
    usage: "!clear all/done/@user",
    description: "Clear tasks",
    permission: "mods",
  },
];

/** Reference rows for the Timer tab. Every timer command is mod-only. */
export const timerCommands: CommandRow[] = [
  {
    command: "!timer start",
    usage: "!timer start [cycles]",
    description: "Start the timer",
    permission: "mods",
  },
  {
    command: "!timer pause",
    usage: "!timer pause",
    description: "Pause the timer",
    permission: "mods",
  },
  {
    command: "!timer resume",
    usage: "!timer resume",
    description: "Resume the timer",
    permission: "mods",
  },
  {
    command: "!timer skip",
    usage: "!timer skip",
    description: "Skip the current phase",
    permission: "mods",
  },
  {
    command: "!timer reset",
    usage: "!timer reset",
    description: "Stop and reset the timer",
    permission: "mods",
  },
  {
    command: "!timer eta",
    usage: "!timer eta",
    description: "Show when the timer ends",
    permission: "mods",
  },
];

/** Reference rows for the Moderation card. Mod-only, and never alias targets. */
export const moderationCommands: CommandRow[] = [
  { command: "!mute", usage: "!mute", description: "Pause the bot", permission: "mods" },
  { command: "!unmute", usage: "!unmute", description: "Resume the bot", permission: "mods" },
  {
    command: "!block",
    usage: "!block @user",
    description: "Block a viewer and remove their tasks",
    permission: "mods",
  },
  {
    command: "!unblock",
    usage: "!unblock @user",
    description: "Let a blocked viewer use commands again",
    permission: "mods",
  },
];

/**
 * Collapsible legend of a tab's commands. Open by default; `disabled` dims the rows and
 * chips the header so a switched-off group is visible where the commands are listed, not
 * only at the switch. Mod-only rows carry a "Mods" chip, explained by a legend line under
 * the list.
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
  const hasModRows = commands.some((cmd) => cmd.permission === "mods");
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="font-mono text-xs font-medium text-foreground">{cmd.command}</code>
              <span className="text-xs text-muted-foreground">{cmd.description}</span>
              {cmd.permission === "mods" && <StatusChip tone="alt" size="sm" label="Mods" />}
            </div>
            <code className="block font-mono text-[11px] text-muted-foreground/80">
              {cmd.usage}
            </code>
          </li>
        ))}
      </ul>
      {hasModRows && (
        <p className="border-t border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
          Mods = moderators and the streamer.
        </p>
      )}
    </SectionGroup>
  );
}
