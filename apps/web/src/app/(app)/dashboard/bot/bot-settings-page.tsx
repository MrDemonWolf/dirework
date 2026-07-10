"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MonitorPlay,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import { cn } from "@/lib/utils";
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
import { SaveBar } from "@/components/save-bar";
import { TwitchIcon } from "@/components/icons/twitch-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  taskMessageFields,
  timerMessageFields,
} from "@/components/bot-settings/message-editor";
import {
  CommandTabPanel,
  knownAliasTargets,
  taskCommands,
  timerCommands,
} from "@/components/bot-settings/command-tab-panel";
import {
  CommandAliasEditor,
  aliasesToRows,
  rowsToAliases,
  type AliasRow,
} from "@/components/bot-settings/command-alias-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";

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
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
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
  const [showUrl, setShowUrl] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const regenerateBotToken = useMutation({
    ...trpc.bot.regenerateBotToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      toast.success("Bot page token regenerated — the old URL no longer works");
    },
    onError: (err) => {
      toast.error(`Couldn't regenerate the bot token: ${err.message}`);
    },
  });

  const botToken = ingestInfo.data?.botToken;
  const botUrl = origin && botToken ? `${origin}/bot/${botToken}` : "";
  const ready = hasBotAccount && Boolean(botToken);

  const copyUrl = async () => {
    if (!botUrl) return;
    try {
      await navigator.clipboard.writeText(botUrl);
      toast.success("Bot page URL copied");
    } catch {
      toast.error("Couldn't copy — copy the URL manually");
    }
  };

  return (
    <Card className="panel-hero">
      <CardHeader className="border-b border-border/40 px-5">
        <div className="console-rule">
          <span className="console-label">Bot Runtime</span>
        </div>
        <CardTitle className="font-heading text-lg font-semibold tracking-tight">
          {botName ?? "Bot console"}
        </CardTitle>
        <CardAction>
          <StatusChip
            tone={ready ? "accent" : "idle"}
            label={ready ? "Ready" : "Not configured"}
          />
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
        ) : ingestInfo.isLoading ? (
          <Skeleton className="h-9 w-full" />
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

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={showUrl ? botUrl : "•".repeat(40)}
                className="panel-inset h-9 min-w-0 flex-1 truncate px-3 font-mono text-base md:h-8 md:text-xs"
                aria-hidden={showUrl ? undefined : true}
                tabIndex={showUrl ? undefined : -1}
                aria-label={showUrl ? "Bot page URL" : undefined}
              />
              {!showUrl && (
                <span className="sr-only">Bot page URL hidden — press Show to reveal</span>
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setShowUrl((v) => !v)}
                aria-label={showUrl ? "Hide bot page URL" : "Show bot page URL"}
              >
                {showUrl ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                onClick={copyUrl}
                aria-label="Copy bot page URL"
              >
                <Copy className="size-3.5" />
              </Button>
              <div aria-hidden className="mx-1 w-px self-stretch bg-border/40" />
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={regenerateBotToken.isPending}
                    aria-label="Regenerate bot page token"
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                }
                title="Regenerate the bot page token?"
                description="The current bot page URL stops working immediately. Any OBS browser source or pinned tab running the bot goes offline until you open the new URL."
                confirmLabel="Regenerate token"
                onConfirm={() => regenerateBotToken.mutate()}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <a href={botUrl || "#"} target="_blank" rel="noopener noreferrer" />
                }
                disabled={!botUrl}
              >
                <ExternalLink className="size-3.5" />
                Open bot page
              </Button>
            </div>

            <div className="panel-inset flex items-start gap-2.5 p-3">
              <MonitorPlay className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs/relaxed text-muted-foreground">
                Add the URL as an OBS browser source or keep the tab pinned — the bot listens
                while this page is open. The URL contains a secret token, so treat it like a
                stream key.
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
      toast.success("Bot account connected successfully!");
      router.replace("/dashboard/bot");
    } else if (botStatus === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`Failed to connect bot account: ${reason}`);
      router.replace("/dashboard/bot");
    }
  }, [searchParams, router]);

  // Working state
  const [taskCommandsEnabled, setTaskCommandsEnabled] = useState(true);
  const [timerCommandsEnabled, setTimerCommandsEnabled] = useState(true);
  const [taskMessages, setTaskMessages] = useState<TaskMessagesConfig>(DEFAULT_TASK_MESSAGES);
  const [timerMessages, setTimerMessages] = useState<TimerMessagesConfig>(DEFAULT_TIMER_MESSAGES);
  const [aliasRows, setAliasRows] = useState<AliasRow[]>([]);

  // Saved state (for reset)
  const [savedTaskCommandsEnabled, setSavedTaskCommandsEnabled] = useState(true);
  const [savedTimerCommandsEnabled, setSavedTimerCommandsEnabled] = useState(true);
  const [savedTaskMessages, setSavedTaskMessages] = useState<TaskMessagesConfig>(DEFAULT_TASK_MESSAGES);
  const [savedTimerMessages, setSavedTimerMessages] = useState<TimerMessagesConfig>(DEFAULT_TIMER_MESSAGES);
  const [savedAliasRows, setSavedAliasRows] = useState<AliasRow[]>([]);

  // Once config loads, extract values
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!config.data) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const bot = config.data.botConfig;

    const tMsgs = bot?.task ?? DEFAULT_TASK_MESSAGES;
    const tmMsgs = bot?.timer ?? DEFAULT_TIMER_MESSAGES;
    const rows = aliasesToRows(bot?.commandAliases ?? {});

    setTaskCommandsEnabled(bot?.taskCommandsEnabled ?? true);
    setTimerCommandsEnabled(bot?.timerCommandsEnabled ?? true);
    setTaskMessages(tMsgs);
    setTimerMessages(tmMsgs);
    setAliasRows(rows);

    setSavedTaskCommandsEnabled(bot?.taskCommandsEnabled ?? true);
    setSavedTimerCommandsEnabled(bot?.timerCommandsEnabled ?? true);
    setSavedTaskMessages(tMsgs);
    setSavedTimerMessages(tmMsgs);
    setSavedAliasRows(rows);
  }, [config.data]);

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      toast.success("Bot account disconnected");
    },
    onError: (err) => {
      toast.error(`Couldn't disconnect the bot: ${err.message}`);
    },
  });

  const updateMessagesMutation = useMutation({
    ...trpc.config.updateMessages.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save messages: ${err.message}`);
    },
  });

  const updateAliasesMutation = useMutation({
    ...trpc.config.updateCommandAliases.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save aliases: ${err.message}`);
    },
  });

  const isSaving =
    updateMessagesMutation.isPending ||
    updateAliasesMutation.isPending;

  const handleTaskMessagesChange = useCallback((newMessages: TaskMessagesConfig) => {
    setTaskMessages(newMessages);
  }, []);

  const handleTimerMessagesChange = useCallback((newMessages: TimerMessagesConfig) => {
    setTimerMessages(newMessages);
  }, []);

  const handleAliasRowsChange = useCallback((rows: AliasRow[]) => {
    setAliasRows(rows);
  }, []);

  const handleReset = useCallback(() => {
    setTaskCommandsEnabled(savedTaskCommandsEnabled);
    setTimerCommandsEnabled(savedTimerCommandsEnabled);
    setTaskMessages(savedTaskMessages);
    setTimerMessages(savedTimerMessages);
    setAliasRows(savedAliasRows);
  }, [
    savedTaskCommandsEnabled,
    savedTimerCommandsEnabled,
    savedTaskMessages,
    savedTimerMessages,
    savedAliasRows,
  ]);

  const handleSave = useCallback(async () => {
    const { aliases, duplicates } = rowsToAliases(aliasRows);
    if (duplicates.length > 0) {
      toast.error(`Duplicate ${duplicates.length === 1 ? "alias" : "aliases"}: ${duplicates.join(", ")} — rename or remove before saving.`);
      return;
    }

    // Save the two groups independently and snapshot each only on ITS
    // success — the old sequential version marked nothing saved on a partial
    // failure, so the UI showed the messages as unsaved even though the
    // server had them, and Reset silently diverged from the server.
    const results = await Promise.allSettled([
      updateMessagesMutation
        .mutateAsync({
          taskCommandsEnabled,
          timerCommandsEnabled,
          task: taskMessages,
          timer: timerMessages,
        })
        .then(() => {
          setSavedTaskCommandsEnabled(taskCommandsEnabled);
          setSavedTimerCommandsEnabled(timerCommandsEnabled);
          setSavedTaskMessages(taskMessages);
          setSavedTimerMessages(timerMessages);
        }),
      updateAliasesMutation
        .mutateAsync({ commandAliases: aliases })
        .then(() => {
          setSavedAliasRows(aliasRows);
        }),
    ]);

    if (results.every((r) => r.status === "fulfilled")) {
      toast.success("Bot settings saved");
    }
    // Failures were already toasted by each mutation's onError; the failed
    // group stays dirty so the Save bar keeps offering a retry.
  }, [
    taskCommandsEnabled,
    timerCommandsEnabled,
    taskMessages,
    timerMessages,
    aliasRows,
    updateMessagesMutation,
    updateAliasesMutation,
  ]);

  // Per-tab dirty flags for the TabsTrigger indicator dots (spec §5.4)
  const taskDirty =
    taskCommandsEnabled !== savedTaskCommandsEnabled ||
    !shallowEqualRecords(taskMessages, savedTaskMessages);
  const timerDirty =
    timerCommandsEnabled !== savedTimerCommandsEnabled ||
    !shallowEqualRecords(timerMessages, savedTimerMessages);
  const aliasDirty =
    aliasRows.length !== savedAliasRows.length ||
    aliasRows.some(
      (row, i) =>
        row.key !== savedAliasRows[i]?.key || row.value !== savedAliasRows[i]?.value,
    );

  // Single source of truth: the guard + save bar derive from the same
  // comparisons as the tab dots, so reverting an edit clears them all.
  const hasUnsaved = taskDirty || timerDirty || aliasDirty;

  // Wait for BOTH queries — rendering on config alone flashed a false
  // "Not connected / Not configured" while the user query was still loading.
  if (config.isLoading || user.isLoading) {
    return <BotSettingsSkeleton />;
  }

  const botAccount = user.data?.botAccount ?? null;

  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Bot Settings</h1>
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
              <div className="console-rule">
                <span className="console-label">Identity</span>
              </div>
              <CardTitle className="font-heading text-lg font-semibold tracking-tight">
                Bot Account
              </CardTitle>
              <CardAction>
                {botAccount ? (
                  <StatusChip tone="live" label="Connected" />
                ) : (
                  <StatusChip tone="idle" label="Not connected" />
                )}
              </CardAction>
              <CardDescription>The Twitch account the bot chats as</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              {botAccount ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm">
                      Connected as <span className="font-medium">{botAccount.displayName}</span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">@{botAccount.username}</p>
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
                    description="The bot stops responding in chat immediately and its Twitch authorization is revoked. Any open bot page goes offline. You can reconnect the same account later."
                    confirmLabel="Disconnect bot"
                    onConfirm={() => disconnectBot.mutate()}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No bot account connected. Sign in with the Twitch account you want chatting —
                    most streamers use a dedicated second account.
                  </p>
                  <Button
                    size="sm"
                    className="bg-twitch text-white hover:bg-twitch-hover"
                    nativeButton={false}
                    render={<a href="/api/bot/authorize" />}
                  >
                    <TwitchIcon className="size-3.5" />
                    Connect Bot Account
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
              <div className="console-rule">
                <span className="console-label">Chat Commands</span>
              </div>
              <CardTitle className="font-heading text-lg font-semibold tracking-tight">
                Commands &amp; messages
              </CardTitle>
              <CardDescription>
                Toggle command groups, review usage, and tune the bot&apos;s replies
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <Tabs defaultValue="tasks">
                <TabsList>
                  <TabsTrigger
                    value="tasks"
                    aria-label={taskDirty ? "Task Commands (unsaved changes)" : undefined}
                  >
                    Task Commands
                    {taskDirty && (
                      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="timer"
                    aria-label={timerDirty ? "Timer Commands (unsaved changes)" : undefined}
                  >
                    Timer Commands
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
                    title="Task Commands"
                    subtitle="Viewer task management via chat"
                    idPrefix="task"
                    enabled={taskCommandsEnabled}
                    onEnabledChange={setTaskCommandsEnabled}
                    commands={taskCommands}
                    fields={taskMessageFields}
                    messages={taskMessages}
                    onMessagesChange={handleTaskMessagesChange}
                    disabledNote="Task commands are disabled — enable them to edit messages."
                  />
                </TabsContent>

                {/* Timer Commands Tab */}
                <TabsContent value="timer">
                  <CommandTabPanel
                    title="Timer Commands"
                    subtitle="Mod-only timer control via chat"
                    idPrefix="timer"
                    enabled={timerCommandsEnabled}
                    onEnabledChange={setTimerCommandsEnabled}
                    commands={timerCommands}
                    fields={timerMessageFields}
                    messages={timerMessages}
                    onMessagesChange={handleTimerMessagesChange}
                    disabledNote="Timer commands are disabled — enable them to edit messages."
                  />
                </TabsContent>

                {/* Aliases Tab */}
                <TabsContent value="aliases">
                  <CommandAliasEditor
                    rows={aliasRows}
                    onChange={handleAliasRowsChange}
                    knownCommands={knownAliasTargets}
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
      />
    </div>
  );
}
