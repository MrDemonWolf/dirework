"use client";

// Bot settings → Replies (/dashboard/bot/replies): what the bot says in chat. A Task / Timer
// switcher sits over one reply editor; each group header names the commands that send its
// replies. The Save bar sends the two reply sets only (`config.updateBotSettings` takes any
// subset), so it never touches the aliases or the command switches.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "@/lib/config-types";
import {
  type BotMessageFieldRef,
  type BotMessageTab,
  botMessageFieldFor,
  invalidMessageKeys,
} from "@/lib/bot-settings-fields";
import {
  TASK_MESSAGE_GROUP_COMMANDS,
  TIMER_MESSAGE_GROUP_COMMANDS,
  taskMessageFields,
  timerMessageFields,
} from "@/lib/message-fields";
import { previewVars } from "@/lib/template-preview";
import { cn } from "@/lib/utils";
import { describeFieldIssues, formatMutationError } from "@/lib/validation-errors";
import { MessageEditor } from "@/components/bot-settings/message-editor";
import { SaveBar } from "@/components/save-bar";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";
import { type BotConfigData, type BotUserData, useBotData } from "../bot-data";

/** What the Save bar persists, held as one object so draft and saved can't drift. */
interface RepliesDraft {
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

/** Cheap slice compare for the per-set dirty dots. */
function sameReplies<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

export default function RepliesPage() {
  const { config, user } = useBotData();
  return <RepliesEditor config={config} user={user} />;
}

const SET_LABEL: Record<BotMessageTab, string> = { task: "Task replies", timer: "Timer replies" };

/**
 * Draft and saved are seeded in STATE from the config this mounts with (prefetched on the
 * server, so it is in the cache on first render): the saved values land in the server HTML
 * and no frame of defaults is painted first. A refetch re-renders with new props but touches
 * no state, so edits in progress survive it.
 */
function RepliesEditor({ config, user }: { config: BotConfigData; user: BotUserData }) {
  const queryClient = useQueryClient();
  const bot = config.botConfig;

  const [draft, setDraft] = useState<RepliesDraft>(() => ({
    task: bot.task ?? DEFAULT_TASK_MESSAGES,
    timer: bot.timer ?? DEFAULT_TIMER_MESSAGES,
  }));
  const [saved, setSaved] = useState<RepliesDraft>(draft);
  // Controlled, so the Save bar's blocked reason can switch to the set holding the bad field.
  const [set, setSet] = useState<BotMessageTab>("task");
  // Each set's filter, held here so the Save bar's link can clear one hiding its field.
  const [filters, setFilters] = useState<Record<BotMessageTab, string>>({ task: "", timer: "" });

  const save = useMutation({
    ...trpc.config.updateBotSettings.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save replies: ${formatMutationError(err)}`);
    },
  });

  // The server's own input schema over the exact payload: a field it would reject blocks
  // Save (and is named in the Save bar) instead of failing the whole save.
  const payload = { task: draft.task, timer: draft.timer };
  const check = updateBotSettingsInput.safeParse(payload);
  const issues = check.success ? [] : check.error.issues;
  const described = issues.length > 0 ? describeFieldIssues(issues, botMessageFieldFor) : null;
  const blockedReason = described?.text ?? null;
  const blockedField: BotMessageFieldRef | null = described?.field ?? null;
  const focusBlockedField = () => {
    if (!blockedField) return;
    setSet(blockedField.tab);
    // A filter on that set may be hiding the field (the editor renders only matches).
    setFilters((f) => ({ ...f, [blockedField.tab]: "" }));
    // After the set and the field render; the field's group is open (it holds an invalid one).
    requestAnimationFrame(() => {
      const el = document.getElementById(blockedField.fieldId);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  const handleSave = async () => {
    if (blockedReason) {
      toast.error(`Couldn't save replies: ${blockedReason}`);
      return;
    }
    try {
      // Edits made while the request is in flight stay dirty.
      const submitted = draft;
      await save.mutateAsync(payload);
      setSaved(submitted);
      toast.success("Replies saved");
    } catch {
      // onError already toasted; nothing persisted, so the Save bar keeps offering a retry.
    }
  };

  const dirty: Record<BotMessageTab, boolean> = {
    task: !sameReplies(draft.task, saved.task),
    timer: !sameReplies(draft.timer, saved.timer),
  };
  const hasUnsaved = dirty.task || dirty.timer;

  // Reply previews read like a line in the streamer's own chat, spoken by the bot account.
  const preview = {
    speaker: user.botAccount?.username ?? "bot",
    vars: previewVars(user.name || "streamer"),
  };

  const groupOff = (tab: BotMessageTab) =>
    !(tab === "task" ? bot.taskCommandsEnabled : bot.timerCommandsEnabled);

  return (
    <div className={cn(hasUnsaved && "pb-32 sm:pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />
      <Card className="panel">
        <CardHeader className="border-b border-border/40 px-5">
          <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
            Replies
          </CardTitle>
          <CardDescription>
            What the bot says after each command. Each group names the commands that send it.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <Tabs value={set} onValueChange={(next) => setSet(next as BotMessageTab)}>
            <TabsList className="h-9 w-full gap-1 sm:w-auto">
              {(["task", "timer"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  aria-label={dirty[tab] ? `${SET_LABEL[tab]} (unsaved changes)` : undefined}
                >
                  {SET_LABEL[tab]}
                  {dirty[tab] && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
                </TabsTrigger>
              ))}
            </TabsList>

            {(["task", "timer"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4 pt-4">
                {groupOff(tab) && (
                  <Callout
                    variant="info"
                    title={`${tab === "task" ? "Task" : "Timer"} commands are off`}
                  >
                    The bot ignores them in chat, so these replies take effect once you switch them
                    on in{" "}
                    <Link
                      href="/dashboard/bot/commands"
                      prefetch={false}
                      className="font-medium text-link underline-offset-4 hover:underline"
                    >
                      Commands
                    </Link>
                    .
                  </Callout>
                )}
                {tab === "task" ? (
                  <MessageEditor
                    fields={taskMessageFields}
                    idPrefix="task"
                    values={draft.task}
                    saved={saved.task}
                    invalidKeys={invalidMessageKeys(issues, "task")}
                    defaults={DEFAULT_TASK_MESSAGES}
                    onChange={(task) => setDraft((d) => ({ ...d, task }))}
                    filter={filters.task}
                    onFilterChange={(task) => setFilters((f) => ({ ...f, task }))}
                    preview={preview}
                    groupCommands={TASK_MESSAGE_GROUP_COMMANDS}
                  />
                ) : (
                  <MessageEditor
                    fields={timerMessageFields}
                    idPrefix="timer"
                    values={draft.timer}
                    saved={saved.timer}
                    invalidKeys={invalidMessageKeys(issues, "timer")}
                    defaults={DEFAULT_TIMER_MESSAGES}
                    onChange={(timer) => setDraft((d) => ({ ...d, timer }))}
                    filter={filters.timer}
                    onFilterChange={(timer) => setFilters((f) => ({ ...f, timer }))}
                    preview={preview}
                    groupCommands={TIMER_MESSAGE_GROUP_COMMANDS}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <SaveBar
        visible={hasUnsaved}
        saving={save.isPending}
        onSave={handleSave}
        onReset={() => setDraft(saved)}
        label="Unsaved replies"
        blockedReason={blockedReason}
        onBlockedReasonClick={blockedReason ? focusBlockedField : undefined}
      />
    </div>
  );
}
