"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import type { TimerStylesConfig, TaskStylesConfig, ThemePreset } from "@/lib/config-types";
import { deepMerge } from "@/lib/deep-merge";
import { defaultTimerStyles, defaultTaskStyles, themePresets } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeBrowser } from "@/components/theme-center/theme-browser";
import { TimerStyleEditor } from "@/components/theme-center/timer-style-editor";
import { TaskStyleEditor } from "@/components/theme-center/task-style-editor";
import { StylePreviewPanel } from "@/components/theme-center/style-preview-panel";
import { trpc } from "@/utils/trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function StylesSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
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

export default function StylesPage() {
  const queryClient = useQueryClient();
  const config = useQuery(trpc.config.get.queryOptions());

  // Working state — what the user sees and edits
  const [timerStyles, setTimerStyles] = useState<TimerStylesConfig>(defaultTimerStyles);
  const [taskStyles, setTaskStyles] = useState<TaskStylesConfig>(defaultTaskStyles);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Saved state — what's persisted in the database
  const [savedTimerStyles, setSavedTimerStyles] = useState<TimerStylesConfig>(defaultTimerStyles);
  const [savedTaskStyles, setSavedTaskStyles] = useState<TaskStylesConfig>(defaultTaskStyles);

  // Once config loads, merge saved values with defaults
  useEffect(() => {
    if (config.data) {
      const configData = config.data as AnyRecord;
      const mergedTimer = deepMerge(
        defaultTimerStyles,
        (configData.timerStyles as AnyRecord) ?? {},
      ) as unknown as TimerStylesConfig;
      const mergedTask = deepMerge(
        defaultTaskStyles,
        (configData.taskStyles as AnyRecord) ?? {},
      ) as unknown as TaskStylesConfig;

      setTimerStyles(mergedTimer);
      setTaskStyles(mergedTask);
      setSavedTimerStyles(mergedTimer);
      setSavedTaskStyles(mergedTask);

      // Try to detect which preset matches the saved config
      const matchedPreset = detectMatchingPreset(mergedTimer, mergedTask);
      setActiveThemeId(matchedPreset);
    }
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

  const isSaving = updateTimerMutation.isPending || updateTaskMutation.isPending;

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

  const handleApplyTheme = useCallback((theme: ThemePreset) => {
    setTimerStyles(theme.timerStyles);
    setTaskStyles(theme.taskStyles);
    setActiveThemeId(theme.id);
    setHasUnsaved(true);
  }, []);

  const handleReset = useCallback(() => {
    setTimerStyles(savedTimerStyles);
    setTaskStyles(savedTaskStyles);
    setHasUnsaved(false);
    const matchedPreset = detectMatchingPreset(savedTimerStyles, savedTaskStyles);
    setActiveThemeId(matchedPreset);
  }, [savedTimerStyles, savedTaskStyles]);

  const handleSave = useCallback(async () => {
    try {
      await updateTimerMutation.mutateAsync({
        timerStyles: timerStyles as unknown as AnyRecord,
      });
      await updateTaskMutation.mutateAsync({
        taskStyles: taskStyles as unknown as AnyRecord,
      });
      setSavedTimerStyles(timerStyles);
      setSavedTaskStyles(taskStyles);
      setHasUnsaved(false);
      toast.success("Styles saved successfully");
    } catch {
      toast.error("Failed to save styles");
    }
  }, [timerStyles, taskStyles, updateTimerMutation, updateTaskMutation]);

  if (config.isLoading) {
    return <StylesSkeleton />;
  }

  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-8", hasUnsaved && "pb-24")}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Theme Center</h1>
        <p className="text-sm text-muted-foreground">
          Browse preset themes or customize your overlay styles
        </p>
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

      {/* Sticky Save / Reset Bar */}
      {hasUnsaved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
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
