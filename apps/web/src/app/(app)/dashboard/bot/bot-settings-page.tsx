"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  Save,
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/status-chip";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageEditor,
  taskMessageFields,
  timerMessageFields,
} from "@/components/bot-settings/message-editor";
import {
  CommandAliasEditor,
  aliasesToRows,
  rowsToAliases,
  type AliasRow,
} from "@/components/bot-settings/command-alias-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";

const taskCommands = [
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

const timerCommands = [
  { command: "!timer start", usage: "!timer start [cycles]", description: "Start timer" },
  { command: "!timer pause", usage: "!timer pause", description: "Pause timer" },
  { command: "!timer resume", usage: "!timer resume", description: "Resume timer" },
  { command: "!timer skip", usage: "!timer skip", description: "Skip current phase" },
  { command: "!timer reset", usage: "!timer reset", description: "Reset to idle" },
  { command: "!timer eta", usage: "!timer eta", description: "Show end time ETA" },
];

function CommandTable({ commands }: { commands: { command: string; usage: string; description: string }[] }) {
  return (
    <table className="w-full text-xs">
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
  );
}

function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
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
  );
}

/** Bot Console card — the browser page that IS the bot in the CF rebuild. */
function BotConsoleCard({ hasBotAccount }: { hasBotAccount: boolean }) {
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
    <Card>
      <CardHeader>
        <p className="console-label">Bot Runtime</p>
        <CardTitle className="font-heading text-base">Bot Console</CardTitle>
        <CardDescription>
          The bot runs inside a browser page — no server process. Open the tokenized page below
          and it connects to Twitch chat and answers commands while it stays open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasBotAccount ? (
          <p className="text-sm text-muted-foreground">
            Connect a bot account above to activate the bot console.
          </p>
        ) : ingestInfo.isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
              <span>
                BOT{" "}
                <span className="text-foreground">
                  {ingestInfo.data?.botUsername ?? "—"}
                </span>
              </span>
              <span>
                CHANNEL{" "}
                <span className="text-foreground">
                  #{ingestInfo.data?.channelName ?? "—"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type={showUrl ? "text" : "password"}
                readOnly
                value={botUrl}
                className="h-9 flex-1 truncate rounded-lg border bg-muted/30 px-3 font-mono text-base md:h-8 md:text-xs"
                aria-label="Bot page URL"
              />
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
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
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
                variant="outline"
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

            <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3">
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
  const [hasUnsaved, setHasUnsaved] = useState(false);

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

  const markUnsaved = useCallback(() => setHasUnsaved(true), []);

  const handleTaskMessagesChange = useCallback((newMessages: TaskMessagesConfig) => {
    setTaskMessages(newMessages);
    setHasUnsaved(true);
  }, []);

  const handleTimerMessagesChange = useCallback((newMessages: TimerMessagesConfig) => {
    setTimerMessages(newMessages);
    setHasUnsaved(true);
  }, []);

  const handleAliasRowsChange = useCallback((rows: AliasRow[]) => {
    setAliasRows(rows);
    setHasUnsaved(true);
  }, []);

  const handleReset = useCallback(() => {
    setTaskCommandsEnabled(savedTaskCommandsEnabled);
    setTimerCommandsEnabled(savedTimerCommandsEnabled);
    setTaskMessages(savedTaskMessages);
    setTimerMessages(savedTimerMessages);
    setAliasRows(savedAliasRows);
    setHasUnsaved(false);
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

    try {
      await updateMessagesMutation.mutateAsync({
        taskCommandsEnabled,
        timerCommandsEnabled,
        task: taskMessages,
        timer: timerMessages,
      });
      await updateAliasesMutation.mutateAsync({
        commandAliases: aliases,
      });

      setSavedTaskCommandsEnabled(taskCommandsEnabled);
      setSavedTimerCommandsEnabled(timerCommandsEnabled);
      setSavedTaskMessages(taskMessages);
      setSavedTimerMessages(timerMessages);
      setSavedAliasRows(aliasRows);
      setHasUnsaved(false);
      toast.success("Bot settings saved");
    } catch {
      // per-mutation onError already surfaced the failure
    }
  }, [
    taskCommandsEnabled,
    timerCommandsEnabled,
    taskMessages,
    timerMessages,
    aliasRows,
    updateMessagesMutation,
    updateAliasesMutation,
  ]);

  if (config.isLoading) {
    return <BotSettingsSkeleton />;
  }

  const botAccount = user.data?.botAccount ?? null;

  return (
    <div className={cn("container mx-auto max-w-5xl px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Bot Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connect the bot account, run the bot console, and tune its chat responses
        </p>
      </div>

      <div className="stagger-reveal space-y-6">
        {/* Bot Account */}
        <Card>
          <CardHeader>
            <p className="console-label">Identity</p>
            <div className="flex items-center gap-2.5">
              <CardTitle className="font-heading text-base">Bot Account</CardTitle>
              {botAccount ? (
                <StatusChip tone="live" label="Connected" />
              ) : (
                <StatusChip tone="idle" label="Not connected" />
              )}
            </div>
            <CardDescription>The Twitch account the bot chats as</CardDescription>
          </CardHeader>
          <CardContent>
            {botAccount ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">
                    Connected as <span className="font-medium">{botAccount.displayName}</span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">@{botAccount.username}</p>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" size="sm" disabled={disconnectBot.isPending}>
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
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No bot account connected. Sign in with the Twitch account you want chatting —
                  most streamers use a dedicated second account.
                </p>
                <a
                  href="/api/bot/authorize"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-twitch px-3 text-sm font-medium text-white hover:bg-twitch-hover"
                >
                  <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                  </svg>
                  Connect Bot Account
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot Console — the browser-bot runtime */}
        <BotConsoleCard hasBotAccount={botAccount !== null} />

        {/* Unified Settings Card with Tabs */}
        <Card>
          <CardContent className="px-4 pt-4 pb-4">
            <Tabs defaultValue="tasks">
              <TabsList>
                <TabsTrigger value="tasks">Task Commands</TabsTrigger>
                <TabsTrigger value="timer">Timer Commands</TabsTrigger>
                <TabsTrigger value="aliases">Aliases</TabsTrigger>
              </TabsList>

              {/* Task Commands Tab */}
              <TabsContent value="tasks" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Task Commands</p>
                    <p className="text-xs text-muted-foreground">Viewer task management via chat</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="task-commands-toggle" className="font-mono text-[11px] tracking-wide uppercase">
                      {taskCommandsEnabled ? "On" : "Off"}
                    </Label>
                    <Switch
                      id="task-commands-toggle"
                      checked={taskCommandsEnabled}
                      onCheckedChange={(checked) => { setTaskCommandsEnabled(checked); markUnsaved(); }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="console-label mb-3">Command Reference</h3>
                  <CommandTable commands={taskCommands} />
                </div>

                <Separator />

                <div>
                  <h3 className="console-label mb-3">Messages</h3>
                  <MessageEditor
                    fields={taskMessageFields}
                    idPrefix="task"
                    values={taskMessages}
                    onChange={handleTaskMessagesChange}
                    disabled={!taskCommandsEnabled}
                    disabledNote="Task commands are disabled — enable them to edit messages."
                  />
                </div>
              </TabsContent>

              {/* Timer Commands Tab */}
              <TabsContent value="timer" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Timer Commands</p>
                    <p className="text-xs text-muted-foreground">Mod-only timer control via chat</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timer-commands-toggle" className="font-mono text-[11px] tracking-wide uppercase">
                      {timerCommandsEnabled ? "On" : "Off"}
                    </Label>
                    <Switch
                      id="timer-commands-toggle"
                      checked={timerCommandsEnabled}
                      onCheckedChange={(checked) => { setTimerCommandsEnabled(checked); markUnsaved(); }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="console-label mb-3">Command Reference</h3>
                  <CommandTable commands={timerCommands} />
                </div>

                <Separator />

                <div>
                  <h3 className="console-label mb-3">Messages</h3>
                  <MessageEditor
                    fields={timerMessageFields}
                    idPrefix="timer"
                    values={timerMessages}
                    onChange={handleTimerMessagesChange}
                    disabled={!timerCommandsEnabled}
                    disabledNote="Timer commands are disabled — enable them to edit messages."
                  />
                </div>
              </TabsContent>

              {/* Aliases Tab */}
              <TabsContent value="aliases">
                <CommandAliasEditor rows={aliasRows} onChange={handleAliasRowsChange} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Save / Reset Bar */}
      {hasUnsaved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <p className="console-label">Unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
