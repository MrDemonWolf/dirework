"use client";

// Bot settings (/dashboard/bot): the bot console (secret page URL) and bot account cards side
// by side, then the chat command toggles, reply messages and aliases. Messages and aliases
// save together in one owner-only mutation; the bot OAuth flow returns here with `?bot=`
// status params.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { botOAuthErrorMessage } from "@dirework/api/config-shared";
import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { type AliasRow, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";
import { describeTrpcError } from "@/lib/trpc-errors";
import { cn } from "@/lib/utils";
import { describeIssues, formatMutationError } from "@/lib/validation-errors";
import { BlockedViewersCard } from "@/components/bot-settings/blocked-viewers-card";
import { BotAccountCard } from "@/components/bot-settings/bot-account-card";
import { BotConsoleCard } from "@/components/bot-settings/bot-console-card";
import { BotMuteBar } from "@/components/bot-settings/bot-mute-bar";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { taskCommands, timerCommands } from "@/lib/command-rows";
import { CommandTabPanel } from "@/components/bot-settings/command-tab-panel";
import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
import { SaveBar } from "@/components/save-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";

/** Everything the Save bar persists, held as one object so draft and saved can't drift. */
interface BotSettingsDraft {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
  aliasRows: AliasRow[];
}

/** Pre-load placeholder only; replaced by the stored bot config once `config.get` resolves. */
const INITIAL_DRAFT: BotSettingsDraft = {
  taskCommandsEnabled: true,
  timerCommandsEnabled: true,
  task: DEFAULT_TASK_MESSAGES,
  timer: DEFAULT_TIMER_MESSAGES,
  aliasRows: [],
};

/** Cheap slice compare for the per-tab dirty indicator dots (spec §5.4). */
function shallowEqualRecords<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * Page body. Holds one draft/saved pair (`BotSettingsDraft`) so per-tab dirty dots, the
 * unsaved-changes guard and the Save bar all derive from the same comparison.
 */
export default function BotSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const config = useQuery(trpc.config.get.queryOptions());
  const user = useQuery(trpc.user.me.queryOptions());

  // Handle bot connection callback params (set by the api's /api/bot/callback/twitch
  // redirect), then strip them so a refresh doesn't re-toast.
  useEffect(() => {
    const botStatus = searchParams.get("bot");
    if (botStatus === "connected") {
      toast.success("Bot account connected");
      router.replace("/dashboard/bot");
    } else if (botStatus === "cancelled") {
      toast("Bot connection cancelled");
      router.replace("/dashboard/bot");
    } else if (botStatus === "error") {
      // Map the code to fixed copy — never render the raw query param.
      toast.error(botOAuthErrorMessage(searchParams.get("reason")));
      router.replace("/dashboard/bot");
    }
  }, [searchParams, router]);

  // Working draft + last-saved snapshot (for reset and the dirty indicators)
  const [draft, setDraft] = useState<BotSettingsDraft>(INITIAL_DRAFT);
  const [saved, setSaved] = useState<BotSettingsDraft>(INITIAL_DRAFT);

  // Once config loads, extract values — only the first time, so a refetch (e.g. after Save)
  // never overwrites edits in progress.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!config.data) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const bot = config.data.botConfig;
    const loaded: BotSettingsDraft = {
      taskCommandsEnabled: bot?.taskCommandsEnabled ?? true,
      timerCommandsEnabled: bot?.timerCommandsEnabled ?? true,
      task: bot?.task ?? DEFAULT_TASK_MESSAGES,
      timer: bot?.timer ?? DEFAULT_TIMER_MESSAGES,
      aliasRows: aliasesToRows(bot?.commandAliases ?? {}),
    };
    setDraft(loaded);
    setSaved(loaded);
  }, [config.data]);

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: ({ revoked }) => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      if (revoked) {
        toast.success("Bot account disconnected");
      } else {
        toast.warning("Bot account disconnected, but Twitch didn't confirm the revocation", {
          description:
            "Remove DireWork from the bot account's connections at twitch.tv/settings/connections.",
        });
      }
    },
    onError: (err) => {
      toast.error(`Couldn't disconnect the bot account: ${describeTrpcError(err)}`);
    },
  });

  // Messages + aliases save together in one atomic mutation (both live on the
  // bot_config row) so a save can never persist half the page.
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
    taskCommandsEnabled: draft.taskCommandsEnabled,
    timerCommandsEnabled: draft.timerCommandsEnabled,
    task: draft.task,
    timer: draft.timer,
    commandAliases: aliasResult.aliases,
  };
  const payloadCheck = updateBotSettingsInput.safeParse(payload);
  const blockedReason =
    aliasResult.issues.length > 0
      ? "Fix the highlighted aliases before saving."
      : payloadCheck.success
        ? null
        : describeIssues(payloadCheck.error.issues);

  const handleSave = async () => {
    if (blockedReason) {
      toast.error(`Couldn't save bot settings: ${blockedReason}`);
      return;
    }

    // ONE atomic mutation: messages and aliases both live on the bot_config
    // row, so saving them as two requests could persist one and drop the other,
    // leaving the UI's saved snapshot out of sync with the server.
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
  const taskDirty =
    draft.taskCommandsEnabled !== saved.taskCommandsEnabled ||
    !shallowEqualRecords(draft.task, saved.task);
  const timerDirty =
    draft.timerCommandsEnabled !== saved.timerCommandsEnabled ||
    !shallowEqualRecords(draft.timer, saved.timer);
  const aliasDirty =
    draft.aliasRows.length !== saved.aliasRows.length ||
    draft.aliasRows.some(
      (row, i) => row.key !== saved.aliasRows[i]?.key || row.value !== saved.aliasRows[i]?.value,
    );

  // Single source of truth: the guard + save bar derive from the same
  // comparisons as the tab dots, so reverting an edit clears them all.
  const hasUnsaved = taskDirty || timerDirty || aliasDirty;

  // Wait for BOTH queries — rendering on config alone flashed a false
  // "Not connected / Not configured" while the user query was still loading.
  if (config.isPending || user.isPending) {
    return <BotSettingsSkeleton />;
  }

  // Never render the editors over defaults after a failed load: saving them
  // would overwrite the streamer's real messages and aliases.
  if (!config.data || !user.data) {
    const failed = !config.data ? config : user;
    return (
      <div className="container mx-auto max-w-content px-4 py-8">
        <QueryError
          title="Couldn't load bot settings"
          onRetry={() => failed.refetch()}
          retrying={failed.isFetching}
        />
      </div>
    );
  }

  const botAccount = user.data.botAccount ?? null;
  // Reply previews read like a line in the streamer's own chat, spoken by the bot account.
  const preview = {
    speaker: botAccount?.username ?? "bot",
    vars: previewVars(user.data.name || "streamer"),
  };

  return (
    <div className={cn("container mx-auto max-w-content px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bot settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the bot account and decide what it says in chat
        </p>
      </div>

      <div className="stagger-reveal space-y-6">
        {/* Mute switch and the Moderation card save on their own (not through the Save bar),
            so both read the live query data, never the draft. */}
        <BotMuteBar muted={config.data.botConfig.muted} />

        {/* Runtime + identity, side by side on wide screens. */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <BotConsoleCard hasBotAccount={botAccount !== null} />
          <BotAccountCard
            botAccount={botAccount}
            onDisconnect={() => disconnectBot.mutate()}
            disconnecting={disconnectBot.isPending}
          />
        </div>

        {/* Chat commands console, full width. */}
        <Card className="panel">
          <CardHeader className="border-b border-border/40 px-5">
            <ConsoleRule label="Chat commands" />
            <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
              Commands &amp; messages
            </CardTitle>
            <CardDescription>
              Switch command groups on or off and word the bot&apos;s replies
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Tabs defaultValue="tasks">
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

              {/* Task Commands Tab */}
              <TabsContent value="tasks" className="pt-2">
                <CommandTabPanel
                  title="Task commands"
                  subtitle="Viewers manage their tasks from chat"
                  idPrefix="task"
                  enabled={draft.taskCommandsEnabled}
                  onEnabledChange={(taskCommandsEnabled) =>
                    setDraft((d) => ({ ...d, taskCommandsEnabled }))
                  }
                  commands={taskCommands}
                  fields={taskMessageFields}
                  messages={draft.task}
                  defaults={DEFAULT_TASK_MESSAGES}
                  onMessagesChange={(task) => setDraft((d) => ({ ...d, task }))}
                  preview={preview}
                />
              </TabsContent>

              {/* Timer Commands Tab */}
              <TabsContent value="timer" className="pt-2">
                <CommandTabPanel
                  title="Timer commands"
                  subtitle="Mods control the timer from chat"
                  idPrefix="timer"
                  enabled={draft.timerCommandsEnabled}
                  onEnabledChange={(timerCommandsEnabled) =>
                    setDraft((d) => ({ ...d, timerCommandsEnabled }))
                  }
                  commands={timerCommands}
                  fields={timerMessageFields}
                  messages={draft.timer}
                  defaults={DEFAULT_TIMER_MESSAGES}
                  onMessagesChange={(timer) => setDraft((d) => ({ ...d, timer }))}
                  preview={preview}
                />
              </TabsContent>

              {/* Aliases Tab */}
              <TabsContent value="aliases" className="space-y-4 pt-2">
                <CommandAliasEditor
                  rows={draft.aliasRows}
                  onChange={(aliasRows) => setDraft((d) => ({ ...d, aliasRows }))}
                />
                <p className="text-xs text-muted-foreground">
                  An open bot page picks up new aliases within an hour, or right away when you
                  reload it.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <BlockedViewersCard blockedViewers={config.data.botConfig.blockedViewers} />
      </div>

      {/* Sticky Save / Reset Bar */}
      <SaveBar
        visible={hasUnsaved}
        saving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
        blockedReason={blockedReason}
      />
    </div>
  );
}
