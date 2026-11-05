"use client";

// Theme Center (/dashboard/styles): preset gallery, timer/task style editors, phase labels, and
// a live preview. Edits stay local until Save, which persists all three slices in one mutation.

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { MoreHorizontal, RotateCcw } from "lucide-react";

import type { AppRouter } from "@dirework/api/routers/index";
import { updateStylesInput } from "@dirework/api/routers/input-schemas";

import type {
  TimerStylesConfig,
  TaskStylesConfig,
  PhaseLabelsConfig,
  ThemePreset,
} from "@/lib/config-types";
import { stylesSaved } from "@/lib/config-cache";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import {
  defaultTimerStyles,
  defaultTaskStyles,
  detectMatchingPreset,
  themePresets,
} from "@/lib/theme-presets";
import { useDraft, useSettingsSave } from "@/lib/use-draft";
import { describeIssues } from "@/lib/validation-errors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { SaveBar } from "@/components/save-bar";
import { StylesSkeleton } from "@/components/styles-skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhaseLabelsEditor } from "@/components/theme-center/phase-labels-editor";
import { ThemeBrowser } from "@/components/theme-center/theme-browser";
import { TimerStyleEditor } from "@/components/theme-center/timer-style-editor";
import { TaskStyleEditor } from "@/components/theme-center/task-style-editor";
import { StylePreviewPanel } from "@/components/theme-center/style-preview-panel";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";

type ConfigData = inferRouterOutputs<AppRouter>["config"]["get"];

/** What Save sends (`config.updateStyles`), and the snapshot it commits. */
interface StylesPayload {
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
  phaseLabels: PhaseLabelsConfig;
}

/** Fallback for a config row with no labels yet (defaults mirror the other two slices). */
const defaultPhaseLabels: PhaseLabelsConfig = DEFAULT_PHASE_LABELS;

/** The preset a fresh install starts on ("Reset theme to Default"). */
const DEFAULT_PRESET = themePresets.find((preset) => preset.id === "default")!;

/**
 * Hands the editors a snapshot of the config to seed from. The route's `StylesSection`
 * mounts this only once the streamed `config.get` has settled, so it is pending here only
 * when nothing was streamed (the server's fetch failed) and the browser fetches it itself.
 */
export default function StylesPage() {
  const config = useQuery(trpc.config.get.queryOptions());

  if (config.isPending) {
    return <StylesSkeleton />;
  }

  // Never render the editors over defaults after a failed load: saving them
  // would overwrite the streamer's real theme.
  if (!config.data) {
    return (
      <div className="container mx-auto max-w-content px-4 py-8">
        <QueryError
          title="Couldn't load your styles"
          onRetry={() => config.refetch()}
          retrying={config.isFetching}
        />
      </div>
    );
  }

  return <StylesEditor config={config.data} />;
}

/**
 * Keeps a working copy and a last-saved snapshot of each slice (`useDraft`). Applying a preset
 * over unsaved custom edits asks for confirmation first.
 *
 * Both copies are seeded in STATE from the config this mounts with, never copied in from a
 * later render: the route streams `config.get` from the server and mounts this only once it
 * has landed, so the data is already in the cache when this first renders, and seeding here
 * puts the saved theme in the server HTML instead of painting (and serving) a frame of
 * defaults that an effect then swaps out — an edit landing during that swap was appended to
 * the saved value. A config update (the save's answer merged into the cache) re-renders with new props but
 * touches no state, so edits in progress survive it.
 */
function StylesEditor({ config }: { config: ConfigData }) {
  // Working copy + last-saved snapshot per slice (lib/use-draft.ts), so each tab gets its own
  // dirty dot. Dirty is derived by deep comparison: reverting an edit clears it, and editing
  // back to a preset's exact values re-highlights the preset.
  const timer = useDraft<TimerStylesConfig>(config.timerStyles ?? defaultTimerStyles);
  const task = useDraft<TaskStylesConfig>(config.taskStyles ?? defaultTaskStyles);
  const labels = useDraft<PhaseLabelsConfig>(config.timerConfig?.labels ?? defaultPhaseLabels);
  const timerStyles = timer.draft;
  const taskStyles = task.draft;
  const phaseLabels = labels.draft;
  const setTimerStyles = timer.setDraft;
  const setTaskStyles = task.setDraft;

  // Preset apply held for confirmation while custom edits are unsaved
  const [pendingTheme, setPendingTheme] = useState<ThemePreset | null>(null);
  // "Reset theme to Default" held for confirmation
  const [confirmDefault, setConfirmDefault] = useState(false);

  const hasUnsaved = timer.dirty || task.dirty || labels.dirty;
  const activeThemeId = detectMatchingPreset(timerStyles, taskStyles);

  // ONE atomic mutation for the whole Theme Center (styles and phase labels used to be three
  // independent requests that could persist partially), so the three snapshots committed
  // together can never diverge from what the server holds. The answer is merged into
  // config.get, never re-read.
  const { commit: commitTimer } = timer;
  const { commit: commitTask } = task;
  const { commit: commitLabels } = labels;
  const commit = useCallback(
    (submitted: StylesPayload) => {
      commitTimer(submitted.timerStyles);
      commitTask(submitted.taskStyles);
      commitLabels(submitted.phaseLabels);
    },
    [commitTimer, commitTask, commitLabels],
  );
  const { save, saving } = useSettingsSave({
    noun: "styles",
    mutationOptions: trpc.config.updateStyles.mutationOptions(),
    merge: stylesSaved,
    commit,
  });

  const applyTheme = useCallback(
    (theme: ThemePreset) => {
      setTimerStyles(theme.timerStyles);
      setTaskStyles(theme.taskStyles);
    },
    [setTimerStyles, setTaskStyles],
  );

  const handleApplyTheme = useCallback(
    (theme: ThemePreset) => {
      // Custom edits in progress — confirm before a preset replaces them. When the current
      // styles exactly match a preset, nothing custom would be lost, so no prompt.
      if (hasUnsaved && activeThemeId === null) {
        setPendingTheme(theme);
        return;
      }
      applyTheme(theme);
    },
    [hasUnsaved, activeThemeId, applyTheme],
  );

  const handleReset = () => {
    timer.reset();
    task.reset();
    labels.reset();
  };

  // The server's own input schema over the exact payload: a field it would
  // reject (flagged inline by its editor) blocks Save rather than failing the
  // whole atomic save.
  const payload: StylesPayload = { timerStyles, taskStyles, phaseLabels };
  const payloadCheck = updateStylesInput.safeParse(payload);
  const blockedReason = payloadCheck.success ? null : describeIssues(payloadCheck.error.issues);

  // The payload is also the snapshot: edits made while the request is in flight stay dirty.
  const handleSave = () => save(payload, payload, blockedReason);

  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      <UnsavedChangesGuard dirty={hasUnsaved} />

      {/* No entrance animation: the page arrives finished (the route holds the shell for its
          data, lib/shell-hold.ts) or fills in over its same-shaped skeleton, and a rise-in
          replayed after load read as a second load. */}
      <div>
        <PageHeader
          className="mb-6"
          kicker={<ConsoleRule label="Theme Center" />}
          title="Theme Center"
          description="Start from a preset, fine-tune it, and check the preview. Nothing reaches OBS until you save."
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="Theme options" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={activeThemeId === DEFAULT_PRESET.id}
                  onClick={() => setConfirmDefault(true)}
                >
                  <RotateCcw className="size-3.5" />
                  Reset theme to Default
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        {/* Preset gallery */}
        <div className="mb-6">
          <ConsoleRule as="h2" label="1 · Start from a preset" className="mb-3" />
          <ThemeBrowser activeThemeId={activeThemeId} onApply={handleApplyTheme} />
        </div>

        {/* Preview + editor. The preview comes first in the DOM: below lg it is a sticky bar
            over the editors (StylePreviewPanel's Show/Hide), at lg a rail on the right. */}
        <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-6">
          {/* Preview Column — a fixed-width sticky rail, so live feedback stays in view
              while the editor scrolls; capped to the viewport so a short laptop can
              still scroll the canvas into view. Below lg it sticks under the header. */}
          <div className="sticky top-[calc(var(--spacing-header)+env(safe-area-inset-top,0px))] z-10 w-full min-w-0 lg:top-20 lg:z-auto lg:max-h-[calc(100vh-6rem-var(--save-bar-clearance,0px))] lg:w-96 lg:shrink-0 lg:self-start lg:overflow-y-auto">
            <StylePreviewPanel
              timerStyles={timerStyles}
              taskStyles={taskStyles}
              phaseLabels={phaseLabels}
              showHours={config.timerConfig?.showHours ?? false}
              dirty={hasUnsaved}
            />
          </div>

          {/* Editor Column */}
          <div className="w-full min-w-0 lg:flex-1">
            <ConsoleRule as="h2" label="2 · Customize" className="mb-3" />
            <Tabs defaultValue="timer">
              {/* A dot marks each tab holding unsaved edits, so none hide behind another tab. */}
              <TabsList className="h-9 w-full gap-1">
                <TabsTrigger value="timer" dirty={timer.dirty}>
                  Timer style
                </TabsTrigger>
                <TabsTrigger value="tasks" dirty={task.dirty}>
                  Task style
                </TabsTrigger>
                <TabsTrigger value="labels" dirty={labels.dirty}>
                  Phase labels
                </TabsTrigger>
              </TabsList>
              <TabsContent value="timer">
                <TimerStyleEditor styles={timerStyles} onChange={setTimerStyles} />
              </TabsContent>
              <TabsContent value="tasks">
                <TaskStyleEditor styles={taskStyles} onChange={setTaskStyles} />
              </TabsContent>
              <TabsContent value="labels">
                <PhaseLabelsEditor labels={phaseLabels} onChange={labels.setDraft} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Guard: applying a preset over unsaved custom edits is destructive */}
      <ConfirmDialog
        open={pendingTheme !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTheme(null);
        }}
        title="Replace unsaved edits?"
        description={
          pendingTheme ? `Replace your unsaved custom edits with "${pendingTheme.name}"?` : ""
        }
        confirmLabel="Apply preset"
        onConfirm={() => {
          if (pendingTheme) applyTheme(pendingTheme);
        }}
      />

      {/* Like a preset, the Default theme only replaces the draft; Save puts it on stream. */}
      <ConfirmDialog
        open={confirmDefault}
        onOpenChange={setConfirmDefault}
        title="Reset theme to Default?"
        description="The timer and task styles go back to the Default theme. Phase labels stay as they are, and nothing reaches your stream until you save."
        confirmLabel="Reset to Default"
        onConfirm={() => applyTheme(DEFAULT_PRESET)}
      />

      <SaveBar
        visible={hasUnsaved}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        label="Unsaved — not on stream yet"
        saveHint="Saving updates both OBS overlays"
        blockedReason={blockedReason}
      />
    </div>
  );
}
