"use client";

// Read-only table of chat commands on the Bot settings Commands page: what to type, who may
// type it, and the aliases that also run it (from the alias editor's draft, so a new alias
// shows here as it is typed). The rows live in lib/command-rows.ts.

import type { CommandRow } from "@/lib/command-rows";
import { aliasedCommand, commandName } from "@/lib/command-rows";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/status-chip";

/**
 * From `sm` up: Command · Usage · Who · Aliases columns. On a phone the usage line moves
 * under the command and the table keeps three columns, so nothing scrolls sideways.
 * `disabled` dims the rows (the group is switched off) without hiding them.
 */
export function CommandTable({
  caption,
  commands,
  aliases,
  disabled = false,
}: {
  /** Names the table for screen readers (visually hidden). */
  caption: string;
  commands: readonly CommandRow[];
  /** Canonical aliases by target command name (`aliasesByTarget`). */
  aliases: ReadonlyMap<string, string[]>;
  disabled?: boolean;
}) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-left text-sm transition-opacity motion-reduce:transition-none",
        disabled && "opacity-60",
      )}
    >
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border/60 text-xs text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-medium">
            Command
          </th>
          <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
            Usage
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Who
          </th>
          <th scope="col" className="py-2 font-medium">
            Aliases
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {commands.map((row) => {
          const rowAliases = aliases.get(commandName(row)) ?? [];
          // A usage line that only repeats the command (`!today`) says nothing new.
          const usage = row.usage === row.command ? null : row.usage;
          return (
            <tr key={row.command} className="align-top">
              <th scope="row" className="py-2.5 pr-3 font-normal">
                <code className="font-mono text-sm font-medium text-foreground">{row.command}</code>
                <span className="block text-xs text-muted-foreground">{row.description}</span>
                {usage && (
                  <code className="mt-0.5 block font-mono text-xs text-muted-foreground sm:hidden">
                    {usage}
                  </code>
                )}
              </th>
              <td className="hidden py-2.5 pr-3 sm:table-cell">
                {usage && <code className="font-mono text-xs text-muted-foreground">{usage}</code>}
              </td>
              <td className="py-2.5 pr-3">
                {row.permission === "mods" ? (
                  <StatusChip tone="alt" size="sm" label="Mods" />
                ) : (
                  <StatusChip tone="idle" size="sm" label="Everyone" />
                )}
              </td>
              <td className="py-2.5">
                {rowAliases.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    <span aria-hidden>—</span>
                    <span className="sr-only">None</span>
                  </span>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {rowAliases.map((alias) => (
                      <li key={alias}>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                          {aliasedCommand(row, alias)}
                        </code>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
