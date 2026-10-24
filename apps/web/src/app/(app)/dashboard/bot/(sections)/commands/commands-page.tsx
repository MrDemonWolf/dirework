"use client";

// Bot settings → Commands (/dashboard/bot/commands): every chat command the bot answers, by
// group. Each group's on/off switch saves the moment it flips; its table shows the command,
// usage, who may run it and its aliases (live from the alias editor below). The always-on
// meta commands get a table of their own. The alias editor has this page's only Save bar,
// which sends the aliases alone (`config.updateBotSettings` takes any subset).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { type AliasRow, aliasesByTarget, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { metaCommands, taskCommands, timerCommands } from "@/lib/command-rows";
import {
  type CommandGroup,
  COMMAND_GROUP_LABEL,
  useCommandGroupSwitch,
} from "@/lib/use-command-group-switch";
import { cn } from "@/lib/utils";
import { formatMutationError } from "@/lib/validation-errors";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { CommandTable } from "@/components/bot-settings/command-table";
import { SaveBar } from "@/components/save-bar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";
import { type BotConfigData, useBotData } from "../bot-data";

export default function CommandsPage() {
  const { config } = useBotData();
  return <CommandsEditor config={config} />;
}

const GROUP_COPY: Record<CommandGroup, { description: string; off: string }> = {
  task: {
    description: "Viewers add, finish and manage their own tasks.",
    off: "Off: the bot ignores these in chat. The always-on commands still answer.",
  },
  timer: {
    description: "Mods run the Pomodoro timer from chat.",
    off: "Off: the bot ignores these in chat.",
  },
};

/** One command group: its switch (saved on flip) over its table. */
function CommandGroupCard({
  group,
  enabled,
  aliases,
}: {
  group: CommandGroup;
  enabled: boolean;
  aliases: ReadonlyMap<string, string[]>;
}) {
  const toggle = useCommandGroupSwitch(group, enabled);
  const label = COMMAND_GROUP_LABEL[group];
  const switchId = `${group}-commands-toggle`;
  const rows = (group === "task" ? taskCommands : timerCommands).filter((row) => !row.alwaysOn);
  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          {label}
        </CardTitle>
        <CardDescription>
          {toggle.checked ? GROUP_COPY[group].description : GROUP_COPY[group].off}
        </CardDescription>
        <CardAction className="flex items-center">
          {/* The card title names the switch; the description under it says what on/off means. */}
          <Label htmlFor={switchId} className="sr-only">
            {label}
          </Label>
          <Switch
            id={switchId}
            checked={toggle.checked}
            disabled={toggle.pending}
            onCheckedChange={toggle.onCheckedChange}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-5">
        <CommandTable
          caption={label}
          commands={rows}
          aliases={aliases}
          disabled={!toggle.checked}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Alias rows are seeded in STATE from the config this mounts with (prefetched on the server,
 * so it is in the cache on first render): the saved aliases land in the server HTML. A
 * refetch (after Save, or a switch flip) re-renders with new props but touches no state, so
 * alias edits in progress survive it.
 */
function CommandsEditor({ config }: { config: BotConfigData }) {
  const queryClient = useQueryClient();
  const bot = config.botConfig;

  const [rows, setRows] = useState<AliasRow[]>(() => aliasesToRows(bot.commandAliases ?? {}));
  const [savedRows, setSavedRows] = useState<AliasRow[]>(rows);

  const save = useMutation({
    ...trpc.config.updateBotSettings.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save aliases: ${formatMutationError(err)}`);
    },
  });

  // The same shared validator the server runs; the editor flags each rejected row.
  const result = rowsToAliases(rows);
  const blockedReason = result.issues.length > 0 ? "Fix the highlighted aliases first." : null;
  // The tables show what the draft would save, as it is typed.
  const aliases = aliasesByTarget(result.aliases);

  const dirty =
    rows.length !== savedRows.length ||
    rows.some((row, i) => row.key !== savedRows[i]?.key || row.value !== savedRows[i]?.value);

  const handleSave = async () => {
    if (blockedReason) {
      toast.error(`Couldn't save aliases: ${blockedReason}`);
      return;
    }
    try {
      // Edits made while the request is in flight stay dirty.
      const submitted = rows;
      await save.mutateAsync({ commandAliases: result.aliases });
      setSavedRows(submitted);
      toast.success("Aliases saved");
    } catch {
      // onError already toasted; the Save bar keeps offering a retry.
    }
  };

  const focusFirstBadAlias = () => {
    const first = result.issues[0];
    if (!first) return;
    const el = document.getElementById(`${first.rowId}-${first.field === "key" ? "key" : "cmd"}`);
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className={cn("space-y-6", dirty && "pb-32 sm:pb-24")}>
      <UnsavedChangesGuard dirty={dirty} />

      <CommandGroupCard group="task" enabled={bot.taskCommandsEnabled} aliases={aliases} />
      <CommandGroupCard group="timer" enabled={bot.timerCommandsEnabled} aliases={aliases} />

      <Card className="panel">
        <CardHeader className="border-b border-border/40 px-5">
          <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
            Always on
          </CardTitle>
          <CardDescription>
            Help for viewers. These answer even while Task commands are off.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <CommandTable caption="Always-on commands" commands={metaCommands} aliases={aliases} />
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader className="border-b border-border/40 px-5">
          <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
            Aliases
          </CardTitle>
          <CardDescription>
            Extra names for a command, like <code className="font-mono">!t</code> for{" "}
            <code className="font-mono">!task</code>. They show in the tables above as you type. To
            change what a command says, see{" "}
            <Link
              href="/dashboard/bot/replies"
              prefetch={false}
              className="font-medium text-link underline-offset-4 hover:underline"
            >
              Replies
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <CommandAliasEditor rows={rows} onChange={setRows} />
          <p className="text-xs text-muted-foreground">
            An open bot page picks up new aliases within an hour, or right away when you reload it.
          </p>
        </CardContent>
      </Card>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        onSave={handleSave}
        onReset={() => setRows(savedRows)}
        label="Unsaved aliases"
        blockedReason={blockedReason}
        onBlockedReasonClick={blockedReason ? focusFirstBadAlias : undefined}
      />
    </div>
  );
}
