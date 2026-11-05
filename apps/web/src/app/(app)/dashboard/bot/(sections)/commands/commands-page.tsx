"use client";

// Bot settings → Commands (/dashboard/bot/commands): every chat command the bot answers, by
// group. Each group's on/off switch saves the moment it flips; its table shows the command,
// usage, who may run it and its aliases (live from the alias editor below). The always-on
// meta commands get a table of their own. The alias editor has this page's only Save bar,
// which sends the aliases alone (`config.updateBotSettings` takes any subset).

import Link from "next/link";

import { type AliasRow, aliasesByTarget, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { botSettingsSaved } from "@/lib/config-cache";
import { metaCommands, taskCommands, timerCommands } from "@/lib/command-rows";
import {
  type CommandGroup,
  COMMAND_GROUP_LABEL,
  useCommandGroupSwitch,
} from "@/lib/use-command-group-switch";
import { useDraft, useSettingsSave } from "@/lib/use-draft";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { CommandTable } from "@/components/bot-settings/command-table";
import { SaveBar } from "@/components/save-bar";
import { SettingsCard } from "@/components/bot-settings/settings-card";
import { linkVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";
import { CommandsPlaceholder } from "@/components/bot-settings-skeleton";
import { type BotConfigData, BotSection, useBotConfig } from "../bot-data";

/** Every card reads `config.get`: the group switches, and the aliases the tables show. */
export default function CommandsPage() {
  return (
    <BotSection needs={["config"]} fallback={<CommandsPlaceholder />}>
      <Commands />
    </BotSection>
  );
}

function Commands() {
  return <CommandsEditor config={useBotConfig()} />;
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
    <SettingsCard
      title={label}
      description={toggle.checked ? GROUP_COPY[group].description : GROUP_COPY[group].off}
      action={
        // The card title names the switch; the description under it says what on/off means.
        <>
          <Label htmlFor={switchId} className="sr-only">
            {label}
          </Label>
          <Switch
            id={switchId}
            checked={toggle.checked}
            disabled={toggle.pending}
            onCheckedChange={toggle.onCheckedChange}
          />
        </>
      }
    >
      <CommandTable caption={label} commands={rows} aliases={aliases} disabled={!toggle.checked} />
    </SettingsCard>
  );
}

/**
 * Dirty compares each row's key and value only: a row's id is a client handle (saved rows get
 * `alias-saved-N`, new ones `alias-row-N`), so a row removed and typed back in is no change.
 */
function sameAliasRows(a: AliasRow[], b: AliasRow[]): boolean {
  return (
    a.length === b.length && a.every((row, i) => row.key === b[i]?.key && row.value === b[i]?.value)
  );
}

/**
 * Alias rows (`useDraft`) are seeded in STATE from the config this mounts with (streamed by the (sections)
 * layout; `BotSection` mounts this only once it has data): the saved aliases land in the
 * server HTML. A
 * config update (Save or a switch flip merging its answer into the cache) re-renders with new props but touches no state, so
 * alias edits in progress survive it.
 */
function CommandsEditor({ config }: { config: BotConfigData }) {
  const bot = config.botConfig;

  const {
    draft: rows,
    setDraft: setRows,
    dirty,
    reset,
    commit,
  } = useDraft<AliasRow[]>(() => aliasesToRows(bot.commandAliases ?? {}), sameAliasRows);

  // The answer is the stored bot config: only the aliases are merged into config.get.
  const { save, saving } = useSettingsSave({
    noun: "aliases",
    mutationOptions: trpc.config.updateBotSettings.mutationOptions(),
    merge: botSettingsSaved,
    commit,
  });

  // The same shared validator the server runs; the editor flags each rejected row.
  const result = rowsToAliases(rows);
  const blockedReason = result.issues.length > 0 ? "Fix the highlighted aliases first." : null;
  // The tables show what the draft would save, as it is typed.
  const aliases = aliasesByTarget(result.aliases);

  // The rows it sent are the snapshot: edits made while the request is in flight stay dirty.
  const handleSave = () => save({ commandAliases: result.aliases }, rows, blockedReason);

  const focusFirstBadAlias = () => {
    const first = result.issues[0];
    if (!first) return;
    const el = document.getElementById(`${first.rowId}-${first.field === "key" ? "key" : "cmd"}`);
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-6">
      <UnsavedChangesGuard dirty={dirty} />

      <CommandGroupCard group="task" enabled={bot.taskCommandsEnabled} aliases={aliases} />
      <CommandGroupCard group="timer" enabled={bot.timerCommandsEnabled} aliases={aliases} />

      <SettingsCard
        title="Always on"
        description="Help for viewers. These answer even while Task commands are off."
      >
        <CommandTable caption="Always-on commands" commands={metaCommands} aliases={aliases} />
      </SettingsCard>

      <SettingsCard
        title="Aliases"
        contentClassName="space-y-4"
        description={
          <>
            Extra names for a command, like <code className="font-mono">!t</code> for{" "}
            <code className="font-mono">!task</code>. They show in the tables above as you type. To
            change what a command says, see{" "}
            <Link
              href="/dashboard/bot/replies"
              prefetch={false}
              className={linkVariants({ variant: "prose" })}
            >
              Replies
            </Link>
            .
          </>
        }
      >
        <CommandAliasEditor rows={rows} onChange={setRows} />
        <p className="text-xs text-muted-foreground">
          An open bot page picks up new aliases within an hour, or right away when you reload it.
        </p>
      </SettingsCard>

      <SaveBar
        visible={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={reset}
        label="Unsaved aliases"
        blockedReason={blockedReason}
        onBlockedReasonClick={blockedReason ? focusFirstBadAlias : undefined}
      />
    </div>
  );
}
