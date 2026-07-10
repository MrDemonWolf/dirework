"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { TimerStylesConfig, TaskStylesConfig, PhaseLabelsConfig, ThemePreset } from "@/lib/config-types";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { defaultTimerStyles, defaultTaskStyles, themePresets } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SaveBar } from "@/components/save-bar";
import { StatusChip } from "@/components/status-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhaseLabelsEditor } from "@/components/theme-center/phase-labels-editor";
import { ThemeBrowser } from "@/components/theme-center/theme-browser";
import { TimerStyleEditor } from "@/components/theme-center/timer-style-editor";
import { TaskStyleEditor } from "@/components/theme-center/task-style-editor";
import { StylePreviewPanel } from "@/components/theme-center/style-preview-panel";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { trpc } from "@/utils/trpc";

function StylesSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Preset rail skeleton */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-3 w-16" />
        <div className="flex gap-3 overflow-hidden p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-36 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Editor + preview column skeleton */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 space-y-3 lg:w-[380px] lg:shrink-0">
          <Skeleton className="h-9 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[560px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

const defaultPhaseLabels: PhaseLabelsConfig = DEFAULT_PHASE_LABELS;

export default function StylesPage() {
  const queryClient = useQueryClient();
  const config = useQuery(trpc.config.get.queryOptions());

  // Working state — what the user sees and edits
  const [timerStyles, setTimerStyles] = useState<TimerStylesConfig>(defaultTimerStyles);
  const [taskStyles, setTaskStyles] = useState<TaskStylesConfig>(defaultTaskStyles);
  const [phaseLabels, setPhaseLabels] = useState<PhaseLabelsConfig>(defaultPhaseLabels);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Preset apply held for confirmation while custom edits are unsaved
  const [pendingTheme, setPendingTheme] = useState<ThemePreset | null>(null);

  // Saved state — what's persisted in the database
  const [savedTimerStyles, setSavedTimerStyles] = useState<TimerStylesConfig>(defaultTimerStyles);
  const [savedTaskStyles, setSavedTaskStyles] = useState<TaskStylesConfig>(defaultTaskStyles);
  const [savedPhaseLabels, setSavedPhaseLabels] = useState<PhaseLabelsConfig>(defaultPhaseLabels);

  // Once config loads, initialize — skip on subsequent refetches
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!config.data) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadedTimer = config.data.timerStyles ?? defaultTimerStyles;
    const loadedTask = config.data.taskStyles ?? defaultTaskStyles;
    const loadedLabels = config.data.timerConfig?.labels ?? defaultPhaseLabels;

    setTimerStyles(loadedTimer);
    setTaskStyles(loadedTask);
    setPhaseLabels(loadedLabels);
    setSavedTimerStyles(loadedTimer);
    setSavedTaskStyles(loadedTask);
    setSavedPhaseLabels(loadedLabels);

    const matchedPreset = detectMatchingPreset(loadedTimer, loadedTask);
    setActiveThemeId(matchedPreset);
  }, [config.data]);

  const updateTimerMutation = useMutation({
    ...trpc.config.updateTimerStyles.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save timer styles: ${err.message}`);
    },
  });

  const updateTaskMutation = useMutation({
    ...trpc.config.updateTaskStyles.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save task list styles: ${err.message}`);
    },
  });

  const updatePhaseLabelsMutation = useMutation({
    ...trpc.config.updatePhaseLabels.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't save phase labels: ${err.message}`);
    },
  });

  const isSaving = updateTimerMutation.isPending || updateTaskMutation.isPending || updatePhaseLabelsMutation.isPending;

  const handleTimerChange = useCallback((newStyles: TimerStylesConfig) => {
    setTimerStyles(newStyles);
    setHasUnsaved(true);
    setActiveThemeId(null);
  }, []);

  const handleTaskChange = useCallback((newStyles: TaskStylesConfig) => {
    setTaskStyles(newStyles);
    setHasUnsaved(true);
    setActiveThemeId(null);
  }, []);

  const handlePhaseLabelsChange = useCallback((newLabels: PhaseLabelsConfig) => {
    setPhaseLabels(newLabels);
    setHasUnsaved(true);
  }, []);

  const applyTheme = useCallback((theme: ThemePreset) => {
    setTimerStyles(theme.timerStyles);
    setTaskStyles(theme.taskStyles);
    setActiveThemeId(theme.id);
    setHasUnsaved(true);
  }, []);

  const handleApplyTheme = useCallback((theme: ThemePreset) => {
    // Custom edits in progress — confirm before a preset replaces them
    if (hasUnsaved && activeThemeId === null) {
      setPendingTheme(theme);
      return;
    }
    applyTheme(theme);
  }, [hasUnsaved, activeThemeId, applyTheme]);

  const handleReset = useCallback(() => {
    setTimerStyles(savedTimerStyles);
    setTaskStyles(savedTaskStyles);
    setPhaseLabels(savedPhaseLabels);
    setHasUnsaved(false);
    const matchedPreset = detectMatchingPreset(savedTimerStyles, savedTaskStyles);
    setActiveThemeId(matchedPreset);
  }, [savedTimerStyles, savedTaskStyles, savedPhaseLabels]);

  const handleSave = useCallback(async () => {
    const [timerResult, taskResult, labelsResult] = await Promise.allSettled([
      updateTimerMutation.mutateAsync({ timerStyles }),
      updateTaskMutation.mutateAsync({ taskStyles }),
      updatePhaseLabelsMutation.mutateAsync(phaseLabels),
    ]);

    // Promote working → saved per slice that actually persisted, so Reset
    // restores a truthful snapshot even after a partial failure.
    if (timerResult.status === "fulfilled") setSavedTimerStyles(timerStyles);
    if (taskResult.status === "fulfilled") setSavedTaskStyles(taskStyles);
    if (labelsResult.status === "fulfilled") setSavedPhaseLabels(phaseLabels);

    if ([timerResult, taskResult, labelsResult].every((r) => r.status === "fulfilled")) {
      setHasUnsaved(false);
      toast.success("Styles saved");
    } else {
      // per-mutation onError already surfaced the specifics
      toast.error("Some changes didn't save — try saving again.");
    }
  }, [timerStyles, taskStyles, phaseLabels, updateTimerMutation, updateTaskMutation, updatePhaseLabelsMutation]);

  if (config.isLoading) {
    return <StylesSkeleton />;
  }

  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="stagger-reveal">
        {/* Header band */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="console-rule min-w-0 flex-1">
              <span className="console-label">Theme Center</span>
            </div>
            {hasUnsaved && <StatusChip tone="warn" label="Unsaved" />}
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Theme Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse preset themes or customize your overlay styles
          </p>
        </div>

        {/* Preset rail */}
        <div className="mb-6">
          <div className="console-rule mb-3">
            <span className="console-label">Presets</span>
          </div>
          <ThemeBrowser activeThemeId={activeThemeId} onApply={handleApplyTheme} />
        </div>

        {/* Editor + Preview */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Editor Column */}
          <div className="w-full min-w-0 lg:w-[380px] lg:shrink-0">
            <Tabs defaultValue="timer">
              <TabsList className="h-9 w-full gap-1">
                <TabsTrigger value="timer">Timer</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="timer">
                <div className="space-y-3">
                  <TimerStyleEditor
                    styles={timerStyles}
                    onChange={handleTimerChange}
                  />
                  <PhaseLabelsEditor
                    labels={phaseLabels}
                    onChange={handlePhaseLabelsChange}
                  />
                </div>
              </TabsContent>
              <TabsContent value="tasks">
                <TaskStyleEditor
                  styles={taskStyles}
                  onChange={handleTaskChange}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Column — sticky so live feedback survives scrolling;
              capped to the viewport so short laptops can still scroll to
              the task-list canvas at the bottom of the panel */}
          <div className="min-w-0 flex-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            <StylePreviewPanel
              timerStyles={timerStyles}
              taskStyles={taskStyles}
              phaseLabels={phaseLabels}
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
          pendingTheme
            ? `Replace your unsaved custom edits with "${pendingTheme.name}"?`
            : ""
        }
        confirmLabel="Apply preset"
        onConfirm={() => {
          if (pendingTheme) applyTheme(pendingTheme);
        }}
      />

      <SaveBar
        visible={hasUnsaved}
        saving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}

function detectMatchingPreset(
  timerStyles: TimerStylesConfig,
  taskStyles: TaskStylesConfig,
): string | null {
  const timerJson = JSON.stringify(timerStyles);
  const taskJson = JSON.stringify(taskStyles);

  for (const preset of themePresets) {
    if (
      JSON.stringify(preset.timerStyles) === timerJson &&
      JSON.stringify(preset.taskStyles) === taskJson
    ) {
      return preset.id;
    }
  }
  return null;
}
