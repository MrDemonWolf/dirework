"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radio, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import type { TimerStylesConfig, TaskStylesConfig, PhaseLabelsConfig, ThemePreset } from "@/lib/config-types";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { defaultTimerStyles, defaultTaskStyles, themePresets } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhaseLabelsEditor } from "@/components/theme-center/phase-labels-editor";
import { ThemeBrowser } from "@/components/theme-center/theme-browser";
import { TimerStyleEditor } from "@/components/theme-center/timer-style-editor";
import { TaskStyleEditor } from "@/components/theme-center/task-style-editor";
import { StylePreviewPanel } from "@/components/theme-center/style-preview-panel";
import { trpc } from "@/utils/trpc";

function StylesSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Theme browser skeleton */}
      <div className="mb-6 flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
      <Separator className="mb-6" />
      {/* Two-column skeleton */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-96 lg:shrink-0">
          <Skeleton className="mb-4 h-9 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <Skeleton className="h-[400px] w-full rounded-lg" />
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
  });

  const updateTaskMutation = useMutation({
    ...trpc.config.updateTaskStyles.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const updatePhaseLabelsMutation = useMutation({
    ...trpc.config.updatePhaseLabels.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
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

  const handleApplyTheme = useCallback((theme: ThemePreset) => {
    setTimerStyles(theme.timerStyles);
    setTaskStyles(theme.taskStyles);
    setActiveThemeId(theme.id);
    setHasUnsaved(true);
  }, []);

  const handleReset = useCallback(() => {
    setTimerStyles(savedTimerStyles);
    setTaskStyles(savedTaskStyles);
    setPhaseLabels(savedPhaseLabels);
    setHasUnsaved(false);
    const matchedPreset = detectMatchingPreset(savedTimerStyles, savedTaskStyles);
    setActiveThemeId(matchedPreset);
  }, [savedTimerStyles, savedTaskStyles, savedPhaseLabels]);

  const handleSave = useCallback(async () => {
    try {
      await Promise.all([
        updateTimerMutation.mutateAsync({ timerStyles }),
        updateTaskMutation.mutateAsync({ taskStyles }),
        updatePhaseLabelsMutation.mutateAsync(phaseLabels),
      ]);
      setSavedTimerStyles(timerStyles);
      setSavedTaskStyles(taskStyles);
      setSavedPhaseLabels(phaseLabels);
      setHasUnsaved(false);
      toast.success("Applied to live — your overlays are updated");
    } catch {
      toast.error("Failed to apply styles");
    }
  }, [timerStyles, taskStyles, phaseLabels, updateTimerMutation, updateTaskMutation, updatePhaseLabelsMutation]);

  // Warn before leaving the page with unapplied preview changes
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  // Cmd/Ctrl+S applies the preview to live
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsaved && !isSaving) void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasUnsaved, isSaving, handleSave]);

  if (config.isLoading) {
    return <StylesSkeleton />;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 pb-24">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Theme Center</h1>
          <p className="text-sm text-muted-foreground">
            Changes preview here first — nothing touches your stream until you apply
          </p>
        </div>
        {hasUnsaved ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            Preview — not live yet
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="inline-flex size-2 rounded-full bg-emerald-500" />
            Live — overlays match
          </span>
        )}
      </div>

      {/* Theme Browser */}
      <div className="mb-6">
        <ThemeBrowser activeThemeId={activeThemeId} onApply={handleApplyTheme} />
      </div>

      <Separator className="mb-6" />

      {/* Editor + Preview */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Editor Column */}
        <div className="w-full min-w-0 lg:w-96 lg:shrink-0">
          <Tabs defaultValue="timer">
            <TabsList>
              <TabsTrigger value="timer">Timer</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="timer">
              <div className="max-h-[600px] overflow-y-auto pr-1">
                <TimerStyleEditor
                  styles={timerStyles}
                  onChange={handleTimerChange}
                />
                <Separator className="my-4" />
                <PhaseLabelsEditor
                  labels={phaseLabels}
                  onChange={handlePhaseLabelsChange}
                />
              </div>
            </TabsContent>
            <TabsContent value="tasks">
              <div className="max-h-[600px] overflow-y-auto pr-1">
                <TaskStyleEditor
                  styles={taskStyles}
                  onChange={handleTaskChange}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Column */}
        <div className="flex-1">
          <StylePreviewPanel
            timerStyles={timerStyles}
            taskStyles={taskStyles}
          />
        </div>
      </div>

      {/* Apply-to-live control bar — always mounted, slides in when previewing changes */}
      <div
        aria-hidden={!hasUnsaved}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-2xl transition-all duration-300",
          hasUnsaved
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            Previewing changes — your stream overlays still show the live styles
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              tabIndex={hasUnsaved ? 0 : -1}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Revert
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              tabIndex={hasUnsaved ? 0 : -1}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Radio className="mr-1.5 size-3.5" />
              )}
              Apply to Live
            </Button>
          </div>
        </div>
      </div>
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
