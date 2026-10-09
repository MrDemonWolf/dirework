"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateStylesInput } from "@dirework/api/routers/input-schemas";

import type {
  TimerStylesConfig,
  TaskStylesConfig,
  PhaseLabelsConfig,
  ThemePreset,
} from "@/lib/config-types";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { defaultTimerStyles, defaultTaskStyles, detectMatchingPreset } from "@/lib/theme-presets";
import { cn, isDeepEqual } from "@/lib/utils";
import { describeIssues, formatMutationError } from "@/lib/validation-errors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
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
          {["preset-1", "preset-2", "preset-3", "preset-4", "preset-5"].map((key) => (
            <Skeleton key={key} className="h-32 w-36 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Editor + preview column skeleton */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 space-y-3 lg:w-[380px] lg:shrink-0">
          <Skeleton className="h-9 w-40" />
          {["editor-1", "editor-2", "editor-3", "editor-4"].map((key) => (
            <Skeleton key={key} className="h-24 w-full rounded-xl" />
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
  }, [config.data]);

  // Derived, never tracked by hand: reverting an edit clears the unsaved
  // state, and editing back to a preset's exact values re-highlights it.
  const hasUnsaved =
    !isDeepEqual(timerStyles, savedTimerStyles) ||
    !isDeepEqual(taskStyles, savedTaskStyles) ||
    !isDeepEqual(phaseLabels, savedPhaseLabels);
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
      // Custom edits in progress — confirm before a preset replaces them
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

  if (config.isPending) {
    return <StylesSkeleton />;
  }

  // Never render the editors over defaults after a failed load: saving them
  // would overwrite the streamer's real theme.
  if (!config.data) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <QueryError
          title="Couldn't load your styles"
          onRetry={() => config.refetch()}
          retrying={config.isFetching}
        />
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-8", hasUnsaved && "pb-24")}>
      <UnsavedChangesGuard dirty={hasUnsaved} />

      <div className="stagger-reveal">
        {/* Header band */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <ConsoleRule label="Theme Center" className="min-w-0 flex-1" />
            {hasUnsaved && <StatusChip tone="warn" label="Unsaved" />}
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Theme Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse preset themes or customize your overlay styles
          </p>
        </div>

        {/* Preset rail */}
        <div className="mb-6">
          <ConsoleRule label="Presets" className="mb-3" />
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
                  <TimerStyleEditor styles={timerStyles} onChange={setTimerStyles} />
                  <PhaseLabelsEditor labels={phaseLabels} onChange={setPhaseLabels} />
                </div>
              </TabsContent>
              <TabsContent value="tasks">
                <TaskStyleEditor styles={taskStyles} onChange={setTaskStyles} />
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
              showHours={config.data?.timerConfig?.showHours ?? false}
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
