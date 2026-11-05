"use client";

// Bot settings → Replies (/dashboard/bot/replies): what the bot says in chat. A Task / Timer
// switcher sits over one reply editor; each group header names the commands that send its
// replies. The Save bar sends the two reply sets only (`config.updateBotSettings` takes any
// subset), so it never touches the aliases or the command switches.

import { useState } from "react";
import Link from "next/link";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import { botSettingsSaved } from "@/lib/config-cache";
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
import { useDraft, useSettingsSave } from "@/lib/use-draft";
import { isDeepEqual } from "@/lib/utils";
import { describeFieldIssues } from "@/lib/validation-errors";
import { MessageEditor } from "@/components/bot-settings/message-editor";
import { SaveBar } from "@/components/save-bar";
import { linkVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { SettingsCard } from "@/components/bot-settings/settings-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";
import { RepliesPlaceholder } from "@/components/bot-settings-skeleton";
import {
  type BotConfigData,
  BotSection,
  type BotUserData,
  useBotConfig,
  useBotUser,
} from "../bot-data";

/** What the Save bar persists, held as one object so draft and saved can't drift. */
interface RepliesDraft {
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

/** The editor reads `config.get` (the replies) and `user.me` (previews speak as the bot). */
export default function RepliesPage() {
  return (
    <BotSection needs={["config", "user"]} fallback={<RepliesPlaceholder />}>
      <Replies />
    </BotSection>
  );
}

function Replies() {
  return <RepliesEditor config={useBotConfig()} user={useBotUser()} />;
}

const SET_LABEL: Record<BotMessageTab, string> = { task: "Task replies", timer: "Timer replies" };

/**
 * Draft and saved (`useDraft`) are seeded in STATE from the config this mounts with (streamed
 * by the (sections) layout; `BotSection` mounts this only once it has data): the saved values
 * land in the server HTML and no frame of defaults is painted first. A config update re-renders
 * with new props but touches no state, so edits in progress survive it.
 */
function RepliesEditor({ config, user }: { config: BotConfigData; user: BotUserData }) {
  const bot = config.botConfig;

  const { draft, setDraft, saved, reset, commit } = useDraft<RepliesDraft>(() => ({
    task: bot.task ?? DEFAULT_TASK_MESSAGES,
    timer: bot.timer ?? DEFAULT_TIMER_MESSAGES,
  }));
  // Controlled, so the Save bar's blocked reason can switch to the set holding the bad field.
  const [set, setSet] = useState<BotMessageTab>("task");
  // Each set's filter, held here so the Save bar's link can clear one hiding its field.
  const [filters, setFilters] = useState<Record<BotMessageTab, string>>({ task: "", timer: "" });

  // The answer is the stored bot config: only the replies are merged into config.get.
  const { save, saving } = useSettingsSave({
    noun: "replies",
    mutationOptions: trpc.config.updateBotSettings.mutationOptions(),
    merge: botSettingsSaved,
    commit,
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

  // The draft it sent is the snapshot: edits made while the request is in flight stay dirty.
  const handleSave = () => save(payload, draft, blockedReason);

  // Per set, for the tabs' dirty dots.
  const dirty: Record<BotMessageTab, boolean> = {
    task: !isDeepEqual(draft.task, saved.task),
    timer: !isDeepEqual(draft.timer, saved.timer),
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
    <div>
      <UnsavedChangesGuard dirty={hasUnsaved} />
      <SettingsCard
        title="Replies"
        description="What the bot says after each command. Each group names the commands that send it."
      >
        <Tabs value={set} onValueChange={(next) => setSet(next as BotMessageTab)}>
          <TabsList className="h-9 w-full gap-1 sm:w-auto">
            {(["task", "timer"] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab} dirty={dirty[tab]}>
                {SET_LABEL[tab]}
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
                  The bot ignores them in chat, so these replies take effect once you switch them on
                  in{" "}
                  <Link
                    href="/dashboard/bot/commands"
                    prefetch={false}
                    className={linkVariants({ variant: "proseOnTint" })}
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
      </SettingsCard>

      <SaveBar
        visible={hasUnsaved}
        saving={saving}
        onSave={handleSave}
        onReset={reset}
        label="Unsaved replies"
        blockedReason={blockedReason}
        onBlockedReasonClick={blockedReason ? focusBlockedField : undefined}
      />
    </div>
  );
}
