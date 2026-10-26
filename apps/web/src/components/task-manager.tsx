"use client";

// Dashboard Task Board: the owner's view of every task (theirs and chat's), grouped by
// author, across the full width of its panel (the overlay URLs live in the timer console's
// OBS sources). Polls `task.list` via the authed /rpc proxy; all writes
// go through owner-only task.* procedures, which share service code with the chat commands.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Focus, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueryError } from "@/components/query-error";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_TASK_LEN } from "@/lib/config-types";
import { PANEL_HEADER_CLASS, PANEL_TITLE_CLASS } from "@/lib/panel-header";
import { DASHBOARD_TASKS_POLL_MS, dashboardPollInterval } from "@/lib/poll-intervals";
import {
  canMarkTaskDone,
  groupTasksByAuthor,
  isAtStartCap,
  START_CAP_REASON,
  taskRowActions,
  toRestoreInput,
  type TaskRowAction,
} from "@/lib/task-utils";
import { StatusChip } from "@/components/status-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

/** How long the "Task removed" toast offers Undo. */
const UNDO_TOAST_MS = 5000;

interface TaskManagerProps {
  /** The owner's Twitch id; tasks authored under it are the "Host" group, pinned first. */
  userTwitchId: string;
}

/**
 * The Task Board panel — renders the full panel content (one-line header with the counts
 * and the board options menu, add form, collapsible author groups). The parent supplies the
 * `.panel-hero` chrome.
 */
export function TaskManager({ userTwitchId }: TaskManagerProps) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  // Which bulk clear is waiting on its confirm (opened from the board options menu).
  const [confirmClear, setConfirmClear] = useState<"done" | "all" | null>(null);
  // Author groups the owner folded away. Component state only: a reload opens them all.
  const [collapsedAuthors, setCollapsedAuthors] = useState<ReadonlySet<string>>(() => new Set());
  const setAuthorOpen = (authorKey: string, open: boolean) => {
    setCollapsedAuthors((prev) => {
      const next = new Set(prev);
      if (open) next.delete(authorKey);
      else next.add(authorKey);
      return next;
    });
  };

  const tasks = useQuery({
    ...trpc.task.list.queryOptions(),
    // Slows down after the owner goes idle; every authed poll is billed twice
    // (web worker proxy + api worker), so the cadence lives in poll-intervals.ts.
    refetchInterval: dashboardPollInterval(DASHBOARD_TASKS_POLL_MS),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
  };

  const mutationError = (action: string) => (err: unknown) => {
    toast.error(`Couldn't ${action}: ${describeTrpcError(err)}`);
  };

  const createTask = useMutation({
    ...trpc.task.create.mutationOptions(),
    onSuccess: () => {
      setNewTask("");
      invalidate();
    },
    onError: mutationError("add the task"),
  });

  const markDone = useMutation({
    ...trpc.task.markDone.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("mark the task done"),
  });

  // Status changes (Start / Make focus / Pause) wait for the server, then refetch the list:
  // which status a started task lands in (focus or started) is the server's call.
  const activateTask = useMutation({
    ...trpc.task.activate.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("make the task the focus"),
  });

  const startTask = useMutation({
    ...trpc.task.start.mutationOptions(),
    onSuccess: (result) => {
      invalidate();
      // The button is off at the cap, so these only fire when the list was out of date.
      if (result.outcome === "cap_reached") {
        toast.error(`Couldn't start the task: ${START_CAP_REASON}`);
      } else if (result.outcome === "not_startable") {
        toast.error("Couldn't start the task: it changed since the list loaded");
      }
    },
    onError: mutationError("start the task"),
  });

  const pauseTask = useMutation({
    ...trpc.task.pause.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("pause the task"),
  });

  // One request per click: a row's status actions are off while one of them is in flight.
  const statusBusyIds = new Set(
    [activateTask, startTask, pauseTask].flatMap((m) =>
      m.isPending && m.variables ? [m.variables.id] : [],
    ),
  );

  const restoreTask = useMutation({
    ...trpc.task.restore.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("restore the task"),
  });

  // Removal stays one click; the toast's Undo re-inserts the removed row (one
  // mutation, only when clicked).
  const removeTask = useMutation({
    ...trpc.task.remove.mutationOptions(),
    onSuccess: (removed) => {
      invalidate();
      const snapshot = toRestoreInput(removed);
      if (!snapshot) return;
      toast("Task removed", {
        id: `task-removed-${snapshot.id}`,
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: () => restoreTask.mutate(snapshot) },
      });
    },
    onError: mutationError("remove the task"),
  });

  const clearAll = useMutation({
    ...trpc.task.clearAll.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("clear the tasks"),
  });

  const clearDone = useMutation({
    ...trpc.task.clearDone.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("clear done tasks"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    createTask.mutate({ text: newTask.trim() });
  };

  const taskList = tasks.data?.tasks ?? [];

  // Rows that arrived since the previous list (a chat !task, an add, an Undo)
  // get a one-shot `row-enter`; the first load does not, so the panel doesn't
  // flicker on mount. Derived during render from the query's data identity
  // (React Query's structural sharing keeps it stable across no-op polls)
  // rather than a ref, so it stays pure under StrictMode and the compiler.
  // There is no exit animation: React Query drops the node outright, and the
  // Undo toast already carries the "removed" feedback.
  const [rowEntry, setRowEntry] = useState<{
    source: typeof tasks.data;
    seen: Set<string> | null;
    fresh: Set<string>;
  }>({ source: undefined, seen: null, fresh: new Set() });
  if (tasks.data && tasks.data !== rowEntry.source) {
    const ids = new Set(tasks.data.tasks.map((task) => task.id));
    const previous = rowEntry.seen;
    setRowEntry({
      source: tasks.data,
      seen: ids,
      fresh: previous ? new Set([...ids].filter((id) => !previous.has(id))) : new Set(),
    });
  }

  // Removing a task unmounts its row, and a status change (Start / Make focus / Pause)
  // unmounts the icon button that made it — either drops keyboard focus to <body>. Once
  // the list reflects the change, move focus somewhere sensible (only if it was lost).
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<
    | { kind: "remove"; taskId: string; nextId: string | null }
    | { kind: "status"; taskId: string; from: string }
    | null
  >(null);

  // Runs on every list refresh; "settled" waits until the poll/invalidate result
  // actually reflects the mutation (row gone / status changed) before moving focus.
  useEffect(() => {
    const pending = pendingFocus.current;
    const data = tasks.data?.tasks;
    if (!pending || !data) return;
    const task = data.find((t) => t.id === pending.taskId);
    const settled = pending.kind === "remove" ? !task : task?.status !== pending.from;
    if (!settled) return;
    pendingFocus.current = null;
    const active = document.activeElement;
    // The user already moved focus elsewhere — don't yank it back.
    if (active && active !== document.body) return;
    // Focus targets the neighbor's (or the changed row's) actions menu button, the one
    // control every row renders on every pointer; fall back to the add input when the
    // list empties.
    const targetId = pending.kind === "remove" ? pending.nextId : pending.taskId;
    const target = targetId
      ? listRef.current?.querySelector<HTMLElement>(`[data-row-menu="${CSS.escape(targetId)}"]`)
      : null;
    (target ?? addInputRef.current)?.focus();
  }, [tasks.data]);

  /** Run a row's status action: one request, focus restored once the list shows it. */
  const runStatusAction = (action: TaskRowAction, task: { id: string; status: string }) => {
    if (statusBusyIds.has(task.id)) return;
    pendingFocus.current = { kind: "status", taskId: task.id, from: task.status };
    const mutation = { start: startTask, focus: activateTask, pause: pauseTask }[action];
    mutation.mutate(
      { id: task.id },
      {
        onError: () => {
          pendingFocus.current = null;
        },
      },
    );
  };

  const markTaskDone = (task: { id: string; status: string }) => {
    if (!canMarkTaskDone(task.status)) return;
    if (markDone.isPending && markDone.variables?.id === task.id) return;
    markDone.mutate({ id: task.id });
  };

  const removeRow = (taskId: string) => {
    if (removeTask.isPending && removeTask.variables?.id === taskId) return;
    pendingFocus.current = { kind: "remove", taskId, nextId: neighborTaskId(taskId) };
    removeTask.mutate(
      { id: taskId },
      {
        onError: () => {
          pendingFocus.current = null;
        },
      },
    );
  };

  // The empty board's call to action: bring the add input into view and focus it. Only
  // on a click — focusing on load would jump past the checklist and timer on a hard load.
  const focusAddInput = () => {
    const input = addInputRef.current;
    if (!input) return;
    input.scrollIntoView({ block: "nearest" });
    input.focus({ preventScroll: true });
  };

  // Counts come from the server: the list carries only the newest done tasks
  // (DONE_TASK_LIST_LIMIT), so counting the array would undercount "Done".
  const pendingCount = tasks.data?.counts.open ?? 0;
  const doneCount = tasks.data?.counts.done ?? 0;
  const totalCount = pendingCount + doneCount;

  // Broadcaster group pins first; viewer groups keep list order.
  const groups = groupTasksByAuthor(taskList, tasks.data?.counts.doneByAuthor);
  const orderedGroups = [
    ...groups.filter((g) => g.authorKey === userTwitchId),
    ...groups.filter((g) => g.authorKey !== userTwitchId),
  ];
  // Rows of a folded group aren't rendered, so they can't take focus after a removal.
  const orderedTaskIds = orderedGroups
    .filter((g) => !collapsedAuthors.has(g.authorKey))
    .flatMap((g) => g.tasks.map((t) => t.id));

  /** The row that takes focus after `taskId` is removed: the next one, else the previous. */
  const neighborTaskId = (taskId: string) => {
    const index = orderedTaskIds.indexOf(taskId);
    return orderedTaskIds[index + 1] ?? orderedTaskIds[index - 1] ?? null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Panel header: the title, then the counts and the board options menu */}
      <div className={PANEL_HEADER_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>Tasks</h2>
        <div className="flex items-center gap-4">
          <p className="flex items-baseline gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {pendingCount}
              </span>{" "}
              open
            </span>
            <span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {doneCount}
              </span>{" "}
              done
            </span>
          </p>
          {/* Bulk actions live in a menu, each behind its own confirm. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Task board options" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-card" align="end">
              <DropdownMenuItem
                variant="destructive"
                disabled={doneCount === 0 || clearDone.isPending}
                onClick={() => setConfirmClear("done")}
              >
                Clear done ({doneCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={totalCount === 0 || clearAll.isPending}
                onClick={() => setConfirmClear("all")}
              >
                Clear all ({totalCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            open={confirmClear === "done"}
            onOpenChange={(open) => !open && setConfirmClear(null)}
            title="Clear done tasks?"
            description={`This permanently removes ${doneCount} completed ${doneCount === 1 ? "task" : "tasks"} from the list and the overlay.`}
            confirmLabel="Clear done"
            onConfirm={() => clearDone.mutate()}
          />
          <ConfirmDialog
            open={confirmClear === "all"}
            onOpenChange={(open) => !open && setConfirmClear(null)}
            title="Clear every task?"
            description={`This permanently removes all ${totalCount} ${totalCount === 1 ? "task" : "tasks"}, including viewer tasks, from the list and the overlay. Viewers will need to add theirs again.`}
            confirmLabel="Clear all tasks"
            onConfirm={() => clearAll.mutate()}
          />
        </div>
      </div>

      {/* Body: add form + grouped list */}
      <div className="flex-1 space-y-4 px-5 py-5">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={addInputRef}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task..."
            maxLength={MAX_TASK_LEN}
            disabled={createTask.isPending}
            aria-label="New task text"
            className="h-10 md:h-10"
          />
          <Button
            type="submit"
            disabled={!newTask.trim() || createTask.isPending}
            className="h-10 px-4 md:h-10"
          >
            Add
          </Button>
        </form>

        <div ref={listRef} className="max-h-100 space-y-3 overflow-y-auto">
          {!tasks.data && tasks.isError ? (
            // A failed first load must not masquerade as an empty board.
            <QueryError
              title="Couldn't load tasks"
              onRetry={() => tasks.refetch()}
              retrying={tasks.isFetching}
            />
          ) : !tasks.data ? (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : taskList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              {/* Focus-ring motif empty state */}
              <svg viewBox="0 0 48 48" className="size-10" aria-hidden>
                <title>Decorative empty task ring</title>
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className="stroke-border"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className="stroke-link/60"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="30 96"
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <div className="max-w-72 text-center">
                <p className="font-heading text-base font-semibold tracking-tight">
                  What are you working on today?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Viewers add theirs in chat with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">!task</code>.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={focusAddInput}>
                Add a task
              </Button>
            </div>
          ) : (
            orderedGroups.map((group) => {
              const isHost = group.authorKey === userTwitchId;
              // Start is per author: their focus plus MAX_STARTED_PER_AUTHOR started tasks.
              const atStartCap = isAtStartCap(group.tasks);
              return (
                <Collapsible
                  key={group.authorKey}
                  open={!collapsedAuthors.has(group.authorKey)}
                  onOpenChange={(open) => setAuthorOpen(group.authorKey, open)}
                  className="overflow-hidden rounded-xl border border-border/40 bg-muted/20"
                >
                  {/* Author header (folds the group) — Twitch color only ever tints the dot */}
                  <CollapsibleTrigger className="group/author flex min-h-11 w-full cursor-pointer items-center gap-2.5 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset">
                    <ChevronDown
                      aria-hidden
                      className="size-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]/author:rotate-0"
                    />
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        background: isHost
                          ? "var(--primary)"
                          : (group.authorColor ?? "var(--cornflower)"),
                      }}
                    />
                    <span className="truncate text-sm font-medium">{group.authorDisplayName}</span>
                    {isHost && <StatusChip size="sm" tone="accent" label="Host" />}
                    <span className="console-label ml-auto shrink-0">
                      {group.done}/{group.pending + group.done}
                      <span className="sr-only"> done</span>
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="divide-y divide-border/40 border-t border-border/40">
                      {group.tasks.map((task) => {
                        const isDone = task.status === "done";
                        const isActive = task.status === "active";
                        const isStarted = task.status === "started";
                        return (
                          <li
                            key={task.id}
                            data-active={isActive || undefined}
                            data-status={task.status}
                            // The focus row reads from a soft primary tint plus the
                            // "Focus" chip — no coloured edge bar. Layout: checkbox, then
                            // a body of the task text and a meta line (status chip slot +
                            // row controls). Below `sm` the meta line sits under the text so
                            // the text gets the row's full width on a 320px phone; from
                            // `sm` it rides beside the text.
                            className={cn(
                              "group flex min-h-11 items-start gap-3 px-3 py-3 transition-colors",
                              isActive ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
                              rowEntry.fresh.has(task.id) && "row-enter",
                            )}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              // aria-disabled doesn't block clicks, so markTaskDone guards:
                              // done rows and an in-flight markDone are no-ops.
                              onClick={() => markTaskDone(task)}
                              // aria-disabled (not disabled) so the control keeps
                              // keyboard focus while pending and once done.
                              aria-disabled={
                                isDone || (markDone.isPending && markDone.variables?.id === task.id)
                              }
                              aria-label={
                                isDone ? `${task.text} (done)` : `Mark "${task.text}" as done`
                              }
                              className={cn(
                                // after:-inset-2.5 = 45px effective touch target on a 20px control
                                "relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors after:absolute after:-inset-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                isDone
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground hover:border-primary aria-disabled:cursor-not-allowed aria-disabled:hover:border-muted-foreground",
                              )}
                            >
                              {isDone && <Check className="size-3" />}
                            </button>

                            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                              {/* Task text: wraps in full (no clamp), breaking a long URL or
                                an unbroken word anywhere; dir="auto" lays an RTL task out
                                right to left. */}
                              <p
                                dir="auto"
                                className={cn(
                                  "min-w-0 text-sm wrap-anywhere sm:flex-1",
                                  isDone && "text-muted-foreground line-through",
                                )}
                              >
                                {task.text}
                              </p>

                              <div
                                data-slot="task-row-meta"
                                className="flex min-h-6 items-center gap-2 sm:-my-0.5 sm:shrink-0"
                              >
                                {/* Status chip slot: the focus keeps the lit, pulsing LED; a
                                started task gets a quieter half-lit one. Pending: no chip. */}
                                {isActive && (
                                  <StatusChip
                                    size="sm"
                                    tone="accent"
                                    label="Focus"
                                    pulse
                                    className="shrink-0"
                                  />
                                )}
                                {isStarted && (
                                  <StatusChip
                                    size="sm"
                                    tone="idle"
                                    dot="half"
                                    label="Started"
                                    className="shrink-0"
                                  />
                                )}

                                <TaskRowControls
                                  task={task}
                                  atStartCap={atStartCap}
                                  statusBusy={statusBusyIds.has(task.id)}
                                  removing={
                                    removeTask.isPending && removeTask.variables?.id === task.id
                                  }
                                  onStatusAction={(action) => runStatusAction(action, task)}
                                  onMarkDone={() => markTaskDone(task)}
                                  onRemove={() => removeRow(task.id)}
                                />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </div>

      {/* Footer note: the retention rule behind the Done count */}
      {taskList.length > 0 && (
        <p className="border-t border-border/40 px-5 py-2.5 text-xs text-muted-foreground">
          Done tasks clear automatically after 24h
        </p>
      )}
    </div>
  );
}

/** How each status action reads: menu label, icon, and the icon button's accessible name. */
const STATUS_ACTION_UI: Record<
  TaskRowAction,
  { label: string; icon: LucideIcon; name: (text: string) => string }
> = {
  start: { label: "Start", icon: Play, name: (text) => `Start "${text}"` },
  focus: { label: "Make focus", icon: Focus, name: (text) => `Make "${text}" the focus` },
  pause: { label: "Pause", icon: Pause, name: (text) => `Pause "${text}"` },
};

/**
 * The row controls' hover reveal, on their group (not each button, where a disabled
 * button's `disabled:opacity-50` would win and show it): always shown unless the primary
 * pointer can hover (at any width, so touch tablets keep them); hovering the row, focus
 * inside the group or an open ⋯ menu reveals them.
 */
const HOVER_REVEAL =
  "opacity-100 transition-opacity can-hover:opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100";

/**
 * A row's controls, in the meta line's action group. On a hover-capable (fine) pointer: the
 * row's inline status actions and Remove as small icon buttons, then the ⋯ menu. On a
 * coarse pointer (phones, touch tablets) the icon buttons are gone and the ⋯ menu, a 44px
 * target, holds every action: no swipe or long-press. The menu always lists them all —
 * Start / Make focus / Pause (per `taskRowActions`), Mark done, Remove — so a keyboard user
 * reaches them in one place too.
 */
function TaskRowControls({
  task,
  atStartCap,
  statusBusy,
  removing,
  onStatusAction,
  onMarkDone,
  onRemove,
}: {
  task: { id: string; text: string; status: string };
  /** The author already has a focus and the most started tasks: Start is off. */
  atStartCap: boolean;
  /** A Start / Make focus / Pause request for this row is in flight. */
  statusBusy: boolean;
  removing: boolean;
  onStatusAction: (action: TaskRowAction) => void;
  onMarkDone: () => void;
  onRemove: () => void;
}) {
  const actions = taskRowActions(task.status);
  const isOff = (action: TaskRowAction) => statusBusy || (action === "start" && atStartCap);

  return (
    <div
      data-slot="task-row-controls"
      className={cn("ml-auto flex items-center gap-2", HOVER_REVEAL)}
    >
      {actions
        .filter(({ inline }) => inline)
        .map(({ action }) => {
          const ui = STATUS_ACTION_UI[action];
          const Icon = ui.icon;
          const capped = action === "start" && atStartCap;
          return (
            <Tooltip key={action}>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      if (!isOff(action)) onStatusAction(action);
                    }}
                    disabled={isOff(action)}
                    focusableWhenDisabled
                    aria-label={ui.name(task.text)}
                    className="relative after:absolute after:-inset-2 pointer-coarse:hidden"
                  />
                }
              >
                <Icon className="size-3" />
              </TooltipTrigger>
              <TooltipContent>{capped ? START_CAP_REASON : ui.label}</TooltipContent>
            </Tooltip>
          );
        })}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        disabled={removing}
        focusableWhenDisabled
        aria-label={`Remove "${task.text}"`}
        className="relative text-destructive after:absolute after:-inset-2 hover:bg-destructive/10 hover:text-destructive pointer-coarse:hidden"
      >
        <Trash2 className="size-3" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              data-row-menu={task.id}
              aria-label={`Actions for "${task.text}"`}
              className="relative after:absolute after:-inset-2 pointer-coarse:size-11 pointer-coarse:after:hidden"
            />
          }
        >
          <MoreHorizontal className="size-3.5 pointer-coarse:size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 bg-card" align="end">
          {actions.map(({ action }) => {
            const ui = STATUS_ACTION_UI[action];
            const Icon = ui.icon;
            const capped = action === "start" && atStartCap;
            return (
              <DropdownMenuItem
                key={action}
                disabled={isOff(action)}
                onClick={() => onStatusAction(action)}
                className="pointer-coarse:min-h-11"
              >
                <Icon />
                {capped ? (
                  <span className="flex flex-col gap-1">
                    <span>{ui.label}</span>
                    <span className="text-xs text-muted-foreground">{START_CAP_REASON}</span>
                  </span>
                ) : (
                  ui.label
                )}
              </DropdownMenuItem>
            );
          })}
          {canMarkTaskDone(task.status) && (
            <DropdownMenuItem onClick={onMarkDone} className="pointer-coarse:min-h-11">
              <Check />
              Mark done
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={removing}
            onClick={onRemove}
            className="pointer-coarse:min-h-11"
          >
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
