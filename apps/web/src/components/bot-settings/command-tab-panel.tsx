"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MessageEditor } from "@/components/bot-settings/message-editor";

export interface CommandRow {
  command: string;
  usage: string;
  description: string;
}

export const taskCommands: CommandRow[] = [
  { command: "!task", usage: "!task [task]", description: "Add a task" },
  { command: "!done", usage: "!done or !done [#]", description: "Mark task done" },
  { command: "!edit", usage: "!edit [#] [new task]", description: "Edit a task" },
  { command: "!remove", usage: "!remove [#]", description: "Remove a task" },
  { command: "!focus", usage: "!focus [#]", description: "Set active task" },
  { command: "!check", usage: "!check or !check @user", description: "Check current task" },
  { command: "!next", usage: "!next [task]", description: "Complete & add next task" },
  { command: "!help", usage: "!help", description: "Show help in chat" },
  { command: "!clear", usage: "!clear all/done/@user", description: "Clear tasks (mods only)" },
];

export const timerCommands: CommandRow[] = [
  { command: "!timer start", usage: "!timer start [cycles]", description: "Start timer" },
  { command: "!timer pause", usage: "!timer pause", description: "Pause timer" },
  { command: "!timer resume", usage: "!timer resume", description: "Resume timer" },
  { command: "!timer skip", usage: "!timer skip", description: "Skip current phase" },
  { command: "!timer reset", usage: "!timer reset", description: "Reset to idle" },
  { command: "!timer eta", usage: "!timer eta", description: "Show end time ETA" },
];

/**
 * Built-in command names an alias can target — timer subcommands collapse to
 * their base "!timer" token. Used by the alias editor's unknown-command hint.
 */
export const knownAliasTargets: string[] = [
  ...new Set([
    ...taskCommands.map((c) => c.command),
    ...timerCommands.map((c) => c.command.split(" ")[0] ?? c.command),
  ]),
];

function CommandTable({ commands }: { commands: CommandRow[] }) {
  return (
    <div className="panel-inset overflow-x-auto p-3">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b text-left">
            <th className="console-label pb-1.5 font-medium">Command</th>
            <th className="console-label pb-1.5 font-medium">Usage</th>
            <th className="console-label pb-1.5 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {commands.map((cmd) => (
            <tr key={cmd.command} className="border-b last:border-0">
              <td className="py-1.5 pr-3 font-mono font-medium">{cmd.command}</td>
              <td className="py-1.5 pr-3 font-mono text-muted-foreground">{cmd.usage}</td>
              <td className="py-1.5 text-muted-foreground">{cmd.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ONE tab body shared by the Task and Timer command tabs — toggle header,
 * command reference table, and the message editor (spec §5.4).
 */
export function CommandTabPanel<T extends object>({
  title,
  subtitle,
  idPrefix,
  enabled,
  onEnabledChange,
  commands,
  fields,
  messages,
  onMessagesChange,
  disabledNote,
}: {
  title: string;
  subtitle: string;
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (checked: boolean) => void;
  commands: CommandRow[];
  fields: { key: Extract<keyof T, string>; label: string; placeholder: string; group: string }[];
  messages: T;
  onMessagesChange: (values: T) => void;
  disabledNote: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${idPrefix}-commands-toggle`} className="console-label">
              {enabled ? "On" : "Off"}
            </Label>
            <Switch
              id={`${idPrefix}-commands-toggle`}
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">Saved with the Save bar below.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="console-rule">
          <h3 className="console-label">Command Reference</h3>
        </div>
        <CommandTable commands={commands} />
      </div>

      <div className="space-y-3">
        <div className="console-rule">
          <h3 className="console-label">Messages</h3>
        </div>
        <MessageEditor
          fields={fields}
          idPrefix={idPrefix}
          values={messages}
          onChange={onMessagesChange}
          disabled={!enabled}
          disabledNote={disabledNote}
        />
      </div>
    </div>
  );
}
