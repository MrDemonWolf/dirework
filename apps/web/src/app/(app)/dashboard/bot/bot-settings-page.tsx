"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MonitorPlay, Unplug } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { botOAuthErrorMessage } from "@dirework/api/config-shared";
import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { type AliasRow, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";
import { describeIssues, formatMutationError } from "@/lib/validation-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
import { SaveBar } from "@/components/save-bar";
import { SecretUrlRow } from "@/components/secret-url-row";
import { TwitchIcon } from "@/components/icons/twitch-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskMessageFields, timerMessageFields } from "@/components/bot-settings/message-editor";
import {
  CommandTabPanel,
  taskCommands,
  timerCommands,
} from "@/components/bot-settings/command-tab-panel";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

/** Everything the Save bar persists, held as one object so draft and saved can't drift. */
interface BotSettingsDraft {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
  aliasRows: AliasRow[];
}

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

function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-6 lg:w-80 lg:shrink-0">
          <Card className="panel-hero">
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
          <Card className="panel">
            <CardHeader>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 flex-1">
          <Card className="panel">
            <CardHeader>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-52" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-4 h-9 w-72" />
              <div className="space-y-3">
                {["bot-field-1", "bot-field-2", "bot-field-3", "bot-field-4"].map((key) => (
                  <Skeleton key={key} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Bot Console card — the browser page that IS the bot in the CF rebuild. */
function BotConsoleCard({
  hasBotAccount,
  botName,
}: {
  hasBotAccount: boolean;
  botName: string | null;
}) {
  const queryClient = useQueryClient();
  const ingestInfo = useQuery(trpc.bot.getIngestInfo.queryOptions());
  const origin = useOrigin();

  const regenerateBotToken = useMutation({
    ...trpc.bot.regenerateBotToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      toast.success("Bot page URL reset — the old one no longer works");
    },
    onError: (err) => {
      toast.error(`Couldn't reset the bot page URL: ${describeTrpcError(err)}`);
    },
  });

  const botToken = ingestInfo.data?.botToken;
  const botPath = botToken ? `/bot/${botToken}` : null;
  const botUrl = origin && botPath ? `${origin}${botPath}` : "";
  const ready = hasBotAccount && Boolean(botToken);

  return (
    <Card className="panel-hero">
      <CardHeader className="border-b border-border/40 px-5">
        <ConsoleRule label="Console" />
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          {botName ?? "Bot console"}
        </CardTitle>
        <CardAction>
          <StatusChip tone={ready ? "accent" : "idle"} label={ready ? "Ready" : "Not set up"} />
        </CardAction>
        <CardDescription>
          The bot runs inside a browser page — it chats while the page stays open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {!hasBotAccount ? (
          <p className="text-sm text-muted-foreground">
            Connect a bot account below to activate the bot console.
          </p>
        ) : ingestInfo.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : !ingestInfo.data ? (
          <QueryError
            title="Couldn't load the bot page URL"
            onRetry={() => ingestInfo.refetch()}
            retrying={ingestInfo.isFetching}
          />
        ) : (
          <>
            <div className="grid grid-cols-[3.5rem_1fr] items-baseline gap-y-1">
              <span className="console-label">Bot</span>
              <span className="truncate font-mono text-xs text-foreground">
                {ingestInfo.data?.botUsername ?? "—"}
              </span>
              <span className="console-label">Channel</span>
              <span className="truncate font-mono text-xs text-foreground">
                #{ingestInfo.data?.channelName ?? "—"}
              </span>
            </div>

            <SecretUrlRow
              label="Bot page"
              path={botPath}
              onRegenerate={() => regenerateBotToken.mutate()}
              regenerating={regenerateBotToken.isPending}
              resetDescription="The current bot page URL stops working immediately. Any OBS browser source or pinned tab running the bot goes offline until you open the new URL."
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={botUrl || "#"} target="_blank" rel="noopener noreferrer" />}
                disabled={!botUrl}
              >
                <ExternalLink className="size-3.5" />
                Open bot page
              </Button>
            </div>

            <div className="panel-inset flex items-start gap-2.5 p-3">
              <MonitorPlay className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs/relaxed text-muted-foreground">
                Add the URL as an OBS browser source or keep the tab pinned — the bot listens while
                this page is open. The URL contains a secret token, so treat it like a stream key.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BotSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const config = useQuery(trpc.config.get.queryOptions());
  const user = useQuery(trpc.user.me.queryOptions());

  // Handle bot connection callback params
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

  // Once config loads, extract values
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
            "Remove Dirework from the bot account's connections at twitch.tv/settings/connections.",
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
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <QueryError
          title="Couldn't load bot settings"
          onRetry={() => failed.refetch()}
          retrying={failed.isFetching}
        />
      </div>
    );
  }

  const botAccount = user.data.botAccount ?? null;

  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bot settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the bot account, run the bot console, and tune its chat responses
        </p>
      </div>

      <div className="stagger-reveal flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left rail — runtime hero above identity */}
        <div className="flex w-full flex-col gap-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto">
          {/* Bot Console — the browser-bot runtime */}
          <BotConsoleCard
            hasBotAccount={botAccount !== null}
            botName={botAccount?.displayName ?? null}
          />

          {/* Bot Account */}
          <Card className="panel">
            <CardHeader className="px-5">
              <ConsoleRule label="Identity" />
              <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
                Bot account
              </CardTitle>
              <CardAction>
                {botAccount ? (
                  <StatusChip tone="live" label="Connected" />
                ) : (
                  <StatusChip tone="idle" label="Not connected" />
                )}
              </CardAction>
              <CardDescription>The Twitch account that talks in your chat</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              {botAccount ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm">
                      Connected as <span className="font-medium">{botAccount.displayName}</span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      @{botAccount.username}
                    </p>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="destructive"
                        size="sm"
                        className="self-start"
                        disabled={disconnectBot.isPending}
                      >
                        <Unplug className="size-3" />
                        Disconnect
                      </Button>
                    }
                    title="Disconnect the bot account?"
                    description="The bot stops responding in chat immediately and Dirework asks Twitch to revoke its authorization. Any open bot page goes offline. You can reconnect the same account later."
                    confirmLabel="Disconnect bot"
                    onConfirm={() => disconnectBot.mutate()}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No bot account connected yet. Sign in with the account the bot should chat from
                    — most streamers use a separate second account so replies don&apos;t post as
                    them.
                  </p>
                  <Button
                    size="sm"
                    className="bg-twitch text-white hover:bg-twitch-hover"
                    nativeButton={false}
                    render={<a href="/api/bot/authorize" />}
                  >
                    <TwitchIcon className="size-3.5" />
                    Connect bot account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — chat commands console */}
        <div className="min-w-0 flex-1">
          <Card className="panel">
            <CardHeader className="border-b border-border/40 px-5">
              <ConsoleRule label="Chat commands" />
              <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
                Commands &amp; messages
              </CardTitle>
              <CardDescription>
                Toggle command groups, review usage, and tune the bot&apos;s replies
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
                    {timerDirty && (
                      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="aliases"
                    aria-label={aliasDirty ? "Aliases (unsaved changes)" : undefined}
                  >
                    Aliases
                    {aliasDirty && (
                      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Task Commands Tab */}
                <TabsContent value="tasks">
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
                    onMessagesChange={(task) => setDraft((d) => ({ ...d, task }))}
                    disabledNote="Task commands are disabled — enable them to edit messages."
                  />
                </TabsContent>

                {/* Timer Commands Tab */}
                <TabsContent value="timer">
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
                    onMessagesChange={(timer) => setDraft((d) => ({ ...d, timer }))}
                    disabledNote="Timer commands are disabled — enable them to edit messages."
                  />
                </TabsContent>

                {/* Aliases Tab */}
                <TabsContent value="aliases">
                  <CommandAliasEditor
                    rows={draft.aliasRows}
                    onChange={(aliasRows) => setDraft((d) => ({ ...d, aliasRows }))}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
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
