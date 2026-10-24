"use client";

// Bot settings (/dashboard/bot): the bot console (secret page URL) and bot account cards side
// by side, then the chat command toggles, reply messages and aliases. Messages and aliases
// save together in one owner-only mutation; the bot OAuth flow returns here with `?bot=`
// status params.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { botOAuthErrorMessage } from "@dirework/api/config-shared";
import type { AppRouter } from "@dirework/api/routers/index";
import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { type AliasRow, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { taskMessageFields, timerMessageFields } from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";
import { describeTrpcError } from "@/lib/trpc-errors";
import { cn } from "@/lib/utils";
import {
  BOT_MESSAGE_TAB_VALUE,
  type BotMessageFieldRef,
  type BotMessageTab,
  botMessageFieldFor,
  invalidMessageKeys,
} from "@/lib/bot-settings-fields";
import { describeFieldIssues, formatMutationError } from "@/lib/validation-errors";
import {
  BlockedViewersCard,
  MODERATION_CARD_ID,
} from "@/components/bot-settings/blocked-viewers-card";
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

type ConfigData = inferRouterOutputs<AppRouter>["config"]["get"];
type MeData = NonNullable<inferRouterOutputs<AppRouter>["user"]["me"]>;

/** The stored bot config as the editors hold it (defaults for a row with no values yet). */
function draftFromConfig(bot: ConfigData["botConfig"] | null | undefined): BotSettingsDraft {
  return {
    taskCommandsEnabled: bot?.taskCommandsEnabled ?? true,
    timerCommandsEnabled: bot?.timerCommandsEnabled ?? true,
    task: bot?.task ?? DEFAULT_TASK_MESSAGES,
    timer: bot?.timer ?? DEFAULT_TIMER_MESSAGES,
    aliasRows: aliasesToRows(bot?.commandAliases ?? {}),
  };
}

/** Cheap slice compare for the per-tab dirty indicator dots (spec §5.4). */
function shallowEqualRecords<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/** Loads both queries, handles the bot OAuth return, then hands the editors their data. */
export default function BotSettingsPage() {
  const router = useRouter();
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

  return <BotSettingsEditor config={config.data} user={user.data} />;
}

/**
 * Page body. Holds one draft/saved pair (`BotSettingsDraft`) so per-tab dirty dots, the
 * unsaved-changes guard and the Save bar all derive from the same comparison.
 *
 * Both are seeded in STATE from the config this mounts with (the route prefetches it on the
 * server, so it is in the cache on first render): the saved values land in the server HTML
 * and no frame of defaults is painted first. A refetch (e.g. after Save) re-renders with new
 * props but touches no state, so edits in progress survive it.
 */
function BotSettingsEditor({ config, user }: { config: ConfigData; user: MeData }) {
  const queryClient = useQueryClient();

  // Working draft + last-saved snapshot (for reset and the dirty indicators)
  const [draft, setDraft] = useState<BotSettingsDraft>(() => draftFromConfig(config.botConfig));
  const [saved, setSaved] = useState<BotSettingsDraft>(draft);
  // Controlled, so the Save bar's blocked reason can switch to the tab holding the bad field.
  const [tab, setTab] = useState("tasks");
  // Each command tab's reply filter, held here rather than in the editor so the Save bar's
  // link can clear a filter that hides the field it names.
  const [messageFilters, setMessageFilters] = useState<Record<BotMessageTab, string>>({
    task: "",
    timer: "",
  });

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

  const botAccount = user.botAccount ?? null;
  // Reply previews read like a line in the streamer's own chat, spoken by the bot account.
  const preview = {
    speaker: botAccount?.username ?? "bot",
    vars: previewVars(user.name || "streamer"),
  };

  return (
    <div className={cn("container mx-auto max-w-content px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bot settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the bot account and decide what it says in chat.{" "}
          {/* The command tabs are long; this skips them. */}
          <a
            href={`#${MODERATION_CARD_ID}`}
            className="font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Jump to Moderation
          </a>
        </p>
      </div>

      <div className="stagger-reveal space-y-6">
        {/* Mute switch and the Moderation card save on their own (not through the Save bar),
            so both read the live query data, never the draft. */}
        <BotMuteBar muted={config.botConfig.muted} hasBotAccount={botAccount !== null} />

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
        {/* overflow-visible: the Card primitive clips, which would stop the command
            reference from sticking beside the reply list. */}
        <Card className="panel overflow-visible">
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
                  savedMessages={saved.task}
                  invalidKeys={invalidMessageKeys(payloadIssues, "task")}
                  defaults={DEFAULT_TASK_MESSAGES}
                  onMessagesChange={(task) => setDraft((d) => ({ ...d, task }))}
                  filter={messageFilters.task}
                  onFilterChange={(task) => setMessageFilters((f) => ({ ...f, task }))}
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
                  savedMessages={saved.timer}
                  invalidKeys={invalidMessageKeys(payloadIssues, "timer")}
                  defaults={DEFAULT_TIMER_MESSAGES}
                  onMessagesChange={(timer) => setDraft((d) => ({ ...d, timer }))}
                  filter={messageFilters.timer}
                  onFilterChange={(timer) => setMessageFilters((f) => ({ ...f, timer }))}
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

        <BlockedViewersCard blockedViewers={config.botConfig.blockedViewers} />
      </div>

      {/* Sticky Save / Reset Bar */}
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
