"use client";

// Bot settings → Commands (/dashboard/bot/commands): the Task and Timer command groups (each
// with its on/off switch, command reference and replies) and the aliases. The switches save
// the moment they flip; replies and aliases save together through this page's Save bar, which
// sends only them (`config.updateBotSettings` takes any subset), so it never overwrites a
// switch flipped on the Overview.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { type AliasRow, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";
import { useCommandGroupSwitch } from "@/lib/use-command-group-switch";
import { cn } from "@/lib/utils";
import {
  BOT_MESSAGE_TAB_VALUE,
  type BotMessageFieldRef,
  type BotMessageTab,
  botMessageFieldFor,
  invalidMessageKeys,
} from "@/lib/bot-settings-fields";
import { describeFieldIssues, formatMutationError } from "@/lib/validation-errors";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { taskCommands, timerCommands } from "@/lib/command-rows";
import { CommandTabPanel } from "@/components/bot-settings/command-tab-panel";
import { SaveBar } from "@/components/save-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";
import { type BotConfigData, type BotUserData, useBotData } from "../bot-data";

/** Everything the Save bar persists, held as one object so draft and saved can't drift. */
interface CommandsDraft {
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
  aliasRows: AliasRow[];
}

/** The stored bot config as the editors hold it. */
function draftFromConfig(bot: BotConfigData["botConfig"]): CommandsDraft {
  return {
    task: bot.task ?? DEFAULT_TASK_MESSAGES,
    timer: bot.timer ?? DEFAULT_TIMER_MESSAGES,
    aliasRows: aliasesToRows(bot.commandAliases ?? {}),
  };
}

/** Cheap slice compare for the per-tab dirty indicator dots (spec §5.4). */
function shallowEqualRecords<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/** Hands the editor the data the (sections) layout's gate holds. */
export default function CommandsPage() {
  const { config, user } = useBotData();
  return <CommandsEditor config={config} user={user} />;
}

/**
 * Page body. Holds one draft/saved pair (`CommandsDraft`) so per-tab dirty dots, the
 * unsaved-changes guard and the Save bar all derive from the same comparison.
 *
 * Both are seeded in STATE from the config this mounts with (prefetched on the server, so it
 * is in the cache on first render): the saved values land in the server HTML and no frame of
 * defaults is painted first. A refetch (e.g. after Save, or a switch flip) re-renders with
 * new props but touches no state, so edits in progress survive it.
 */
function CommandsEditor({ config, user }: { config: BotConfigData; user: BotUserData }) {
  const queryClient = useQueryClient();

  // Working draft + last-saved snapshot (for reset and the dirty indicators)
  const [draft, setDraft] = useState<CommandsDraft>(() => draftFromConfig(config.botConfig));
  const [saved, setSaved] = useState<CommandsDraft>(draft);
  // Controlled, so the Save bar's blocked reason can switch to the tab holding the bad field.
  const [tab, setTab] = useState("tasks");
  // Each command tab's reply filter, held here rather than in the editor so the Save bar's
  // link can clear a filter that hides the field it names.
  const [messageFilters, setMessageFilters] = useState<Record<BotMessageTab, string>>({
    task: "",
    timer: "",
  });

  // The group switches are live controls, not draft: they save on flip.
  const taskSwitch = useCommandGroupSwitch("task", config.botConfig.taskCommandsEnabled);
  const timerSwitch = useCommandGroupSwitch("timer", config.botConfig.timerCommandsEnabled);

  // Replies + aliases save together in one atomic mutation (both live on the bot_config
  // row) so a save can never persist half the page.
  const saveBotSettingsMutation = useMutation({
    ...trpc.config.updateBotSettings.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save bot settings: ${formatMutationError(err)}`);
    },
  });

  const isSaving = saveBotSettingsMutation.isPending;

  const handleReset = () => setDraft(saved);

  // Client-side pass over the exact payload with the server's own input schema,
  // so a field it would reject blocks Save instead of failing the whole save.
  const aliasResult = rowsToAliases(draft.aliasRows);
  const payload = {
    task: draft.task,
    timer: draft.timer,
    commandAliases: aliasResult.aliases,
  };
  const payloadCheck = updateBotSettingsInput.safeParse(payload);
  const payloadIssues = payloadCheck.success ? [] : payloadCheck.error.issues;
  // Reply problems are named by the field's label ("'Task added' is over the 300-byte chat
  // limit"), and the reason in the Save bar takes the owner to that field.
  const described =
    payloadIssues.length > 0 ? describeFieldIssues(payloadIssues, botMessageFieldFor) : null;
  const blockedReason =
    aliasResult.issues.length > 0
      ? "Fix the highlighted aliases before saving."
      : (described?.text ?? null);
  const blockedField: BotMessageFieldRef | null =
    aliasResult.issues.length > 0 ? null : (described?.field ?? null);
  const focusBlockedField = () => {
    if (!blockedField) {
      if (aliasResult.issues.length > 0) setTab("aliases");
      return;
    }
    setTab(BOT_MESSAGE_TAB_VALUE[blockedField.tab]);
    // A filter on that tab may be hiding the field (the editor renders only matches).
    setMessageFilters((filters) => ({ ...filters, [blockedField.tab]: "" }));
    // After the panel and the field render; the field's group is open (it holds an invalid
    // field).
    requestAnimationFrame(() => {
      const el = document.getElementById(blockedField.fieldId);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  const handleSave = async () => {
    if (blockedReason) {
      toast.error(`Couldn't save bot settings: ${blockedReason}`);
      return;
    }
    try {
      // Snapshot what is submitted: edits made while the request is in flight
      // must stay dirty rather than being marked saved.
      const submitted = draft;
      await saveBotSettingsMutation.mutateAsync(payload);
      setSaved(submitted);
      toast.success("Bot settings saved");
    } catch {
      // onError already toasted; nothing persisted, so everything stays dirty
      // and the Save bar keeps offering a retry.
    }
  };

  // Per-tab dirty flags for the TabsTrigger indicator dots (spec §5.4)
  const taskDirty = !shallowEqualRecords(draft.task, saved.task);
  const timerDirty = !shallowEqualRecords(draft.timer, saved.timer);
  const aliasDirty =
    draft.aliasRows.length !== saved.aliasRows.length ||
    draft.aliasRows.some(
      (row, i) => row.key !== saved.aliasRows[i]?.key || row.value !== saved.aliasRows[i]?.value,
    );

  // Single source of truth: the guard + save bar derive from the same
  // comparisons as the tab dots, so reverting an edit clears them all.
  const hasUnsaved = taskDirty || timerDirty || aliasDirty;

  const botAccount = user.botAccount ?? null;
  // Reply previews read like a line in the streamer's own chat, spoken by the bot account.
  const preview = {
    speaker: botAccount?.username ?? "bot",
    vars: previewVars(user.name || "streamer"),
  };

  return (
    <div className={cn(hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      {/* overflow-visible: the Card primitive clips, which would stop the command
          reference from sticking beside the reply list. */}
      <Card className="panel overflow-visible">
        <CardHeader className="border-b border-border/40 px-5">
          <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
            Commands &amp; replies
          </CardTitle>
          <CardDescription>
            Switch command groups on or off, word the bot&apos;s replies and add aliases
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
            {/* Full-width rail: triggers are flex-1, so the three tabs
                share the row equally and resize with it. */}
            <TabsList className="h-9 w-full gap-1">
              <TabsTrigger
                value="tasks"
                aria-label={taskDirty ? "Task commands (unsaved changes)" : undefined}
              >
                Task commands
                {taskDirty && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
              </TabsTrigger>
              <TabsTrigger
                value="timer"
                aria-label={timerDirty ? "Timer commands (unsaved changes)" : undefined}
              >
                Timer commands
                {timerDirty && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
              </TabsTrigger>
              <TabsTrigger
                value="aliases"
                aria-label={aliasDirty ? "Aliases (unsaved changes)" : undefined}
              >
                Aliases
                {aliasDirty && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="pt-2">
              <CommandTabPanel
                title="Task commands"
                subtitle="Viewers manage their tasks from chat"
                idPrefix="task"
                enabled={taskSwitch.checked}
                enabledPending={taskSwitch.pending}
                onEnabledChange={taskSwitch.onCheckedChange}
                commands={taskCommands}
                fields={taskMessageFields}
                messages={draft.task}
                savedMessages={saved.task}
                invalidKeys={invalidMessageKeys(payloadIssues, "task")}
                defaults={DEFAULT_TASK_MESSAGES}
                onMessagesChange={(task) => setDraft((d) => ({ ...d, task }))}
                filter={messageFilters.task}
                onFilterChange={(task) => setMessageFilters((f) => ({ ...f, task }))}
                preview={preview}
              />
            </TabsContent>

            <TabsContent value="timer" className="pt-2">
              <CommandTabPanel
                title="Timer commands"
                subtitle="Mods control the timer from chat"
                idPrefix="timer"
                enabled={timerSwitch.checked}
                enabledPending={timerSwitch.pending}
                onEnabledChange={timerSwitch.onCheckedChange}
                commands={timerCommands}
                fields={timerMessageFields}
                messages={draft.timer}
                savedMessages={saved.timer}
                invalidKeys={invalidMessageKeys(payloadIssues, "timer")}
                defaults={DEFAULT_TIMER_MESSAGES}
                onMessagesChange={(timer) => setDraft((d) => ({ ...d, timer }))}
                filter={messageFilters.timer}
                onFilterChange={(timer) => setMessageFilters((f) => ({ ...f, timer }))}
                preview={preview}
              />
            </TabsContent>

            <TabsContent value="aliases" className="space-y-4 pt-2">
              <CommandAliasEditor
                rows={draft.aliasRows}
                onChange={(aliasRows) => setDraft((d) => ({ ...d, aliasRows }))}
              />
              <p className="text-xs text-muted-foreground">
                An open bot page picks up new aliases within an hour, or right away when you reload
                it.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SaveBar
        visible={hasUnsaved}
        saving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
        blockedReason={blockedReason}
        onBlockedReasonClick={blockedReason ? focusBlockedField : undefined}
      />
    </div>
  );
}
