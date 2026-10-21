"use client";

// Theme Center (/dashboard/styles): preset gallery, timer/task style editors, phase labels, and
// a live preview. Edits stay local until Save, which persists all three slices in one mutation.

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import type { AppRouter } from "@dirework/api/routers/index";
import { updateStylesInput } from "@dirework/api/routers/input-schemas";

import type {
  TimerStylesConfig,
  TaskStylesConfig,
  PhaseLabelsConfig,
  ThemePreset,
} from "@/lib/config-types";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import {
  defaultTimerStyles,
  defaultTaskStyles,
  detectMatchingPreset,
  themePresets,
} from "@/lib/theme-presets";
import { cn, isDeepEqual } from "@/lib/utils";
import { describeIssues, formatMutationError } from "@/lib/validation-errors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
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

/** Fallback for a config row with no labels yet (defaults mirror the other two slices). */
const defaultPhaseLabels: PhaseLabelsConfig = DEFAULT_PHASE_LABELS;

/** The preset a fresh install starts on ("Reset theme to Default"). */
const DEFAULT_PRESET = themePresets.find((preset) => preset.id === "default")!;

/** Loads the config, then hands the editors a snapshot to seed from. */
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
 * Keeps a working copy and a last-saved snapshot of each slice; dirty state is derived by deep
 * comparison. Applying a preset over unsaved custom edits asks for confirmation first.
 *
 * Both copies are seeded in STATE from the config this mounts with, never copied in from a
 * later render: the route prefetches `config.get` on the server, so the data is already in
 * the cache when this first renders, and seeding here puts the saved theme in the server
 * HTML instead of painting (and serving) a frame of defaults that an effect then swaps out
 * — an edit landing during that swap was appended to the saved value. A refetch (the
 * post-save invalidation) re-renders with new props but touches no state, so edits in
 * progress survive it.
 */
function StylesEditor({ config }: { config: ConfigData }) {
  const queryClient = useQueryClient();

  const loadedTimer = config.timerStyles ?? defaultTimerStyles;
  const loadedTask = config.taskStyles ?? defaultTaskStyles;
  const loadedLabels = config.timerConfig?.labels ?? defaultPhaseLabels;

  // Working state — what the user sees and edits
  const [timerStyles, setTimerStyles] = useState<TimerStylesConfig>(loadedTimer);
  const [taskStyles, setTaskStyles] = useState<TaskStylesConfig>(loadedTask);
  const [phaseLabels, setPhaseLabels] = useState<PhaseLabelsConfig>(loadedLabels);

  // Preset apply held for confirmation while custom edits are unsaved
  const [pendingTheme, setPendingTheme] = useState<ThemePreset | null>(null);
  // "Reset theme to Default" held for confirmation
  const [confirmDefault, setConfirmDefault] = useState(false);

  // Saved state — what's persisted in the database
  const [savedTimerStyles, setSavedTimerStyles] = useState<TimerStylesConfig>(loadedTimer);
  const [savedTaskStyles, setSavedTaskStyles] = useState<TaskStylesConfig>(loadedTask);
  const [savedPhaseLabels, setSavedPhaseLabels] = useState<PhaseLabelsConfig>(loadedLabels);

  // Derived, never tracked by hand: reverting an edit clears the unsaved
  // state, and editing back to a preset's exact values re-highlights it.
  const timerDirty = !isDeepEqual(timerStyles, savedTimerStyles);
  const taskDirty = !isDeepEqual(taskStyles, savedTaskStyles);
  const labelsDirty = !isDeepEqual(phaseLabels, savedPhaseLabels);
  const hasUnsaved = timerDirty || taskDirty || labelsDirty;
  const activeThemeId = detectMatchingPreset(timerStyles, taskStyles);

  // ONE atomic mutation for the whole Theme Center — styles and phase labels
  // used to be three independent requests that could persist partially.
  const saveStylesMutation = useMutation({
    ...trpc.config.updateStyles.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save styles: ${formatMutationError(err)}`);
    },
  });

  const isSaving = saveStylesMutation.isPending;

  const applyTheme = useCallback((theme: ThemePreset) => {
    setTimerStyles(theme.timerStyles);
    setTaskStyles(theme.taskStyles);
  }, []);

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

  const handleReset = useCallback(() => {
    setTimerStyles(savedTimerStyles);
    setTaskStyles(savedTaskStyles);
    setPhaseLabels(savedPhaseLabels);
  }, [savedTimerStyles, savedTaskStyles, savedPhaseLabels]);

  // The server's own input schema over the exact payload: a field it would
  // reject (flagged inline by its editor) blocks Save rather than failing the
  // whole atomic save.
  const payloadCheck = updateStylesInput.safeParse({ timerStyles, taskStyles, phaseLabels });
  const blockedReason = payloadCheck.success ? null : describeIssues(payloadCheck.error.issues);

  const handleSave = useCallback(async () => {
    if (blockedReason) {
      toast.error(`Couldn't save styles: ${blockedReason}`);
      return;
    }
    try {
      // Atomic server-side: either all three slices persist or none do, so the
      // saved snapshot below can never diverge from what the server holds.
      await saveStylesMutation.mutateAsync({ timerStyles, taskStyles, phaseLabels });
      setSavedTimerStyles(timerStyles);
      setSavedTaskStyles(taskStyles);
      setSavedPhaseLabels(phaseLabels);
      toast.success("Styles saved");
    } catch {
      // onError already surfaced the specifics; nothing persisted.
    }
  }, [blockedReason, timerStyles, taskStyles, phaseLabels, saveStylesMutation]);

  return (
    <div className={cn("container mx-auto max-w-content px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="stagger-reveal">
        {/* Header band */}
        <div className="mb-6">
          <ConsoleRule label="Theme Center" />
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Theme Center</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse preset themes or customize your overlay styles
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="Theme options" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card">
                <DropdownMenuItem
                  disabled={activeThemeId === DEFAULT_PRESET.id}
                  onClick={() => setConfirmDefault(true)}
                >
                  <RotateCcw className="size-3.5" />
                  Reset theme to Default
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Preset gallery */}
        <div className="mb-6">
          <ConsoleRule label="Presets" className="mb-3" />
          <ThemeBrowser activeThemeId={activeThemeId} onApply={handleApplyTheme} />
        </div>

        {/* Editor + Preview */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Editor Column */}
          <div className="w-full min-w-0 lg:flex-1">
            <Tabs defaultValue="timer">
              {/* A dot marks each tab holding unsaved edits, so none hide behind another tab. */}
              <TabsList className="h-9 w-full gap-1">
                <TabsTrigger value="timer" dirty={timerDirty}>
                  Timer style
                </TabsTrigger>
                <TabsTrigger value="tasks" dirty={taskDirty}>
                  Task style
                </TabsTrigger>
                <TabsTrigger value="labels" dirty={labelsDirty}>
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
                <PhaseLabelsEditor labels={phaseLabels} onChange={setPhaseLabels} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Column — a fixed-width sticky rail, so live feedback stays in view
              while the editor scrolls; capped to the viewport so a short laptop can
              still scroll the canvas into view */}
          <div className="w-full min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-96 lg:shrink-0 lg:self-start lg:overflow-y-auto">
            <StylePreviewPanel
              timerStyles={timerStyles}
              taskStyles={taskStyles}
              phaseLabels={phaseLabels}
              showHours={config.timerConfig?.showHours ?? false}
              dirty={hasUnsaved}
            />
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
        saving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
        label="Unsaved — not on stream yet"
        saveHint="Saving updates both OBS overlays"
        blockedReason={blockedReason}
      />
    </div>
  );
}
