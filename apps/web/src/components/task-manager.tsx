"use client";

// Dashboard Task Board: the owner's view of every task (theirs and chat's), grouped by
// author, across the full width of its panel (the overlay URLs live in the timer console's
// OBS sources). Polls `task.list` via the authed /rpc proxy; all writes
// go through owner-only task.* procedures, which share service code with the chat commands.
//
// Render boundaries (`task-board-structure.test.ts` pins them): the add field's draft lives in
// AddTaskForm, and each row is a TaskRow whose props are stable between board renders: the
// task object (React Query keeps it structurally shared across polls), primitive flags, and
// callbacks built only from refs and each mutation's stable `mutate`. TaskManager never holds
// a whole useMutation / useQuery result (both are new objects every render), so a row action
// or a chat !task re-renders the row that changed and its group header, not every row.

import { type Ref, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Focus, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, destructiveIconButton, focusRing } from "@/components/ui/button";
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
  neighborRowId,
  START_CAP_REASON,
  taskRowActions,
  toRestoreInput,
  type Task,
  type TaskRowAction,
} from "@/lib/task-utils";
import { StatusChip } from "@/components/status-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toastMutationError } from "@/lib/validation-errors";
import { trpc } from "@/utils/trpc";

/** How long the "Task removed" toast offers Undo. */
const UNDO_TOAST_MS = 5000;

/** The `?? []` fallback, one array for the module's life, so it never reads as a new list. */
const NO_TASKS: readonly Task[] = [];

/** The ids of the board's rendered rows, in order (a folded group's rows aren't rendered). */
function renderedRowIds(list: HTMLElement | null): string[] {
  if (!list) return [];
  return Array.from(
    list.querySelectorAll<HTMLElement>("[data-row-menu]"),
    (el) => el.dataset.rowMenu ?? "",
  );
}

/** Where focus goes once the list shows a row action: see the effect in TaskManager. */
type PendingFocus =
  | { kind: "remove"; taskId: string; nextId: string | null }
  | { kind: "status"; taskId: string; from: string };

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

  // Only `data` and `isError` are read, so React Query re-renders the board when one of them
  // changes, never on a poll's fetching flag (the failed-load retry reads that in its own child).
  const { data, isError } = useQuery({
    ...trpc.task.list.queryOptions(),
    // Slows down after the owner goes idle; every authed poll is billed twice
    // (web worker proxy + api worker), so the cadence lives in poll-intervals.ts.
    refetchInterval: dashboardPollInterval(DASHBOARD_TASKS_POLL_MS),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
  };

  // Removing a task unmounts its row, and a status change (Start / Make focus / Pause)
  // unmounts the icon button that made it — either drops keyboard focus to <body>. Once
  // the list reflects the change, move focus somewhere sensible (only if it was lost).
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const clearPendingFocus = () => {
    pendingFocus.current = null;
  };

  // Each mutation is destructured to its stable `mutate` (and the primitives the board shows),
  // never kept whole: see the header comment.
  const {
    mutate: markDone,
    isPending: markingDone,
    variables: markDoneVars,
  } = useMutation({
    ...trpc.task.markDone.mutationOptions(),
    onSuccess: invalidate,
    onError: toastMutationError("mark the task done"),
  });

  // Status changes (Start / Make focus / Pause) wait for the server, then refetch the list:
  // which status a started task lands in (focus or started) is the server's call. A failure
  // drops the pending focus move.
  const {
    mutate: activateTask,
    isPending: activating,
    variables: activateVars,
  } = useMutation({
    ...trpc.task.activate.mutationOptions(),
    onSuccess: invalidate,
    onError: (err) => {
      clearPendingFocus();
      toastMutationError("make the task the focus")(err);
    },
  });

  const {
    mutate: startTask,
    isPending: starting,
    variables: startVars,
  } = useMutation({
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
    onError: (err) => {
      clearPendingFocus();
      toastMutationError("start the task")(err);
    },
  });

  const {
    mutate: pauseTask,
    isPending: pausing,
    variables: pauseVars,
  } = useMutation({
    ...trpc.task.pause.mutationOptions(),
    onSuccess: invalidate,
    onError: (err) => {
      clearPendingFocus();
      toastMutationError("pause the task")(err);
    },
  });

  const { mutate: restoreTask } = useMutation({
    ...trpc.task.restore.mutationOptions(),
    onSuccess: invalidate,
    onError: toastMutationError("restore the task"),
  });

  // Removal stays one click; the toast's Undo re-inserts the removed row (one
  // mutation, only when clicked).
  const {
    mutate: removeTask,
    isPending: removing,
    variables: removeVars,
  } = useMutation({
    ...trpc.task.remove.mutationOptions(),
    onSuccess: (removed) => {
      invalidate();
      const snapshot = toRestoreInput(removed);
      if (!snapshot) return;
      toast("Task removed", {
        id: `task-removed-${snapshot.id}`,
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: () => restoreTask(snapshot) },
      });
    },
    onError: (err) => {
      clearPendingFocus();
      toastMutationError("remove the task")(err);
    },
  });

  const { mutate: clearAll, isPending: clearingAll } = useMutation({
    ...trpc.task.clearAll.mutationOptions(),
    onSuccess: invalidate,
    onError: toastMutationError("clear the tasks"),
  });

  const { mutate: clearDone, isPending: clearingDone } = useMutation({
    ...trpc.task.clearDone.mutationOptions(),
    onSuccess: invalidate,
    onError: toastMutationError("clear done tasks"),
  });

  // The id each in-flight row request is for. One request per click: a row's status actions
  // are off while one of them is in flight (the row guards its own clicks on these flags).
  const markingId = markingDone ? markDoneVars?.id : undefined;
  const removingId = removing ? removeVars?.id : undefined;
  const statusBusyIds = [
    activating ? activateVars?.id : undefined,
    starting ? startVars?.id : undefined,
    pausing ? pauseVars?.id : undefined,
  ];

  const taskList = data?.tasks ?? NO_TASKS;

  // Rows that arrived since the previous list (a chat !task, an add, an Undo)
  // get a one-shot `row-enter`; the first load does not, so the panel doesn't
  // flicker on mount. Derived during render from the query's data identity
  // (React Query's structural sharing keeps it stable across no-op polls)
  // rather than a ref, so it stays pure under StrictMode and the compiler.
  // There is no exit animation: React Query drops the node outright, and the
  // Undo toast already carries the "removed" feedback.
  const [rowEntry, setRowEntry] = useState<{
    source: typeof data;
    seen: Set<string> | null;
    fresh: Set<string>;
  }>({ source: undefined, seen: null, fresh: new Set() });
  if (data && data !== rowEntry.source) {
    const ids = new Set(data.tasks.map((task) => task.id));
    const previous = rowEntry.seen;
    setRowEntry({
      source: data,
      seen: ids,
      fresh: previous ? new Set([...ids].filter((id) => !previous.has(id))) : new Set(),
    });
  }

  // Runs on every list refresh; "settled" waits until the poll/invalidate result
  // actually reflects the mutation (row gone / status changed) before moving focus.
  useEffect(() => {
    const pending = pendingFocus.current;
    const rows = data?.tasks;
    if (!pending || !rows) return;
    const task = rows.find((t) => t.id === pending.taskId);
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
  }, [data]);

  // Row callbacks: built from refs and stable `mutate` functions only, so they keep their
  // identity across board renders. The row checks its own busy flags before calling them.

  /** Run a row's status action: one request, focus restored once the list shows it. */
  const runStatusAction = (action: TaskRowAction, task: Task) => {
    pendingFocus.current = { kind: "status", taskId: task.id, from: task.status };
    ({ start: startTask, focus: activateTask, pause: pauseTask })[action]({ id: task.id });
  };

  const markTaskDone = (taskId: string) => {
    markDone({ id: taskId });
  };

  // The row that takes focus after this one goes is read from the rendered rows at click time.
  const removeRow = (taskId: string) => {
    const nextId = neighborRowId(renderedRowIds(listRef.current), taskId);
    pendingFocus.current = { kind: "remove", taskId, nextId };
    removeTask({ id: taskId });
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
  const pendingCount = data?.counts.open ?? 0;
  const doneCount = data?.counts.done ?? 0;
  const totalCount = pendingCount + doneCount;

  // Broadcaster group pins first; viewer groups keep list order.
  const groups = groupTasksByAuthor(taskList, data?.counts.doneByAuthor);
  const orderedGroups = [
    ...groups.filter((g) => g.authorKey === userTwitchId),
    ...groups.filter((g) => g.authorKey !== userTwitchId),
  ];

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
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuItem
                variant="destructive"
                disabled={doneCount === 0 || clearingDone}
                onClick={() => setConfirmClear("done")}
              >
                Clear done ({doneCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={totalCount === 0 || clearingAll}
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
            onConfirm={() => clearDone()}
          />
          <ConfirmDialog
            open={confirmClear === "all"}
            onOpenChange={(open) => !open && setConfirmClear(null)}
            title="Clear every task?"
            description={`This permanently removes all ${totalCount} ${totalCount === 1 ? "task" : "tasks"}, including viewer tasks, from the list and the overlay. Viewers will need to add theirs again.`}
            confirmLabel="Clear all tasks"
            onConfirm={() => clearAll()}
          />
        </div>
      </div>

      {/* Body: add form + grouped list */}
      <div className="flex-1 space-y-4 px-5 py-5">
        <AddTaskForm inputRef={addInputRef} />

        <div ref={listRef} className="max-h-100 space-y-3 overflow-y-auto">
          {!data && isError ? (
            // A failed first load must not masquerade as an empty board.
            <TaskListLoadError />
          ) : !data ? (
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
                  <CollapsibleTrigger
                    className={cn(
                      "group/author flex min-h-11 w-full cursor-pointer items-center gap-2.5 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-inset",
                      focusRing,
                    )}
                  >
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
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          fresh={rowEntry.fresh.has(task.id)}
                          atStartCap={atStartCap}
                          statusBusy={statusBusyIds.includes(task.id)}
                          marking={markingId === task.id}
                          removing={removingId === task.id}
                          onStatusAction={runStatusAction}
                          onMarkDone={markTaskDone}
                          onRemove={removeRow}
                        />
                      ))}
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

/**
 * The failed first load: "Couldn't load tasks" with a retry. Its own `task.list` observer
 * reads the fetching flag and the refetch, so TaskManager never subscribes to them (a board
 * that tracked `isFetching` re-rendered every row twice per poll for the rest of the session).
 * `retryOnMount: false`: mounting this observer must not fetch on its own; the board's
 * observer keeps polling, and the retry button fetches.
 */
function TaskListLoadError() {
  const { refetch, isFetching } = useQuery({
    ...trpc.task.list.queryOptions(),
    retryOnMount: false,
  });
  return <QueryError title="Couldn't load tasks" onRetry={() => refetch()} retrying={isFetching} />;
}

/**
 * One board row: the checkbox, the task text and the meta line (status chip + controls). Its
 * props are stable between board renders (primitive flags, the structurally shared task, and
 * callbacks that take the task), so only a row whose task or flags changed re-renders. The
 * busy guards live here: aria-disabled and a menu item's click don't block a call.
 */
function TaskRow({
  task,
  fresh,
  atStartCap,
  statusBusy,
  marking,
  removing,
  onStatusAction,
  onMarkDone,
  onRemove,
}: {
  task: Task;
  /** Arrived since the previous list: plays the one-shot `row-enter`. */
  fresh: boolean;
  /** The author already has a focus and the most started tasks: Start is off. */
  atStartCap: boolean;
  /** A Start / Make focus / Pause request for this row is in flight. */
  statusBusy: boolean;
  /** A mark-done request for this row is in flight. */
  marking: boolean;
  /** A remove request for this row is in flight. */
  removing: boolean;
  onStatusAction: (action: TaskRowAction, task: Task) => void;
  onMarkDone: (taskId: string) => void;
  onRemove: (taskId: string) => void;
}) {
  const isDone = task.status === "done";
  const isActive = task.status === "active";
  const isStarted = task.status === "started";

  const markDone = () => {
    // Done rows and an in-flight mark-done are no-ops.
    if (marking || !canMarkTaskDone(task.status)) return;
    onMarkDone(task.id);
  };
  const statusAction = (action: TaskRowAction) => {
    if (statusBusy || (action === "start" && atStartCap)) return;
    onStatusAction(action, task);
  };
  const remove = () => {
    if (removing) return;
    onRemove(task.id);
  };

  return (
    <li
      data-active={isActive || undefined}
      data-status={task.status}
      // The focus row reads from a soft primary tint plus the "Focus" chip — no coloured
      // edge bar. Layout: checkbox, then a body of the task text and a meta line (status chip
      // slot + row controls). Below `sm` the meta line sits under the text so the text gets
      // the row's full width on a 320px phone; from `sm` it rides beside the text.
      className={cn(
        "group flex min-h-11 items-start gap-3 px-3 py-3 transition-colors",
        isActive ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
        fresh && "row-enter",
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        // aria-disabled doesn't block clicks, so markDone guards: done rows and an
        // in-flight markDone are no-ops.
        onClick={markDone}
        // aria-disabled (not disabled) so the control keeps keyboard focus while pending
        // and once done.
        aria-disabled={isDone || marking}
        aria-label={isDone ? `${task.text} (done)` : `Mark "${task.text}" as done`}
        className={cn(
          // after:-inset-2.5 = 45px effective touch target on a 20px control
          "relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors after:absolute after:-inset-2.5",
          focusRing,
          isDone
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground hover:border-primary aria-disabled:cursor-not-allowed aria-disabled:hover:border-muted-foreground",
        )}
      >
        {isDone && <Check className="size-3" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
        {/* Task text: wraps in full (no clamp), breaking a long URL or an unbroken word
          anywhere; dir="auto" lays an RTL task out right to left. */}
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
          {/* Status chip slot: the focus keeps the lit, pulsing LED; a started task gets a
            quieter half-lit one. Pending: no chip. */}
          {isActive && (
            <StatusChip size="sm" tone="accent" label="Focus" pulse className="shrink-0" />
          )}
          {isStarted && (
            <StatusChip size="sm" tone="idle" dot="half" label="Started" className="shrink-0" />
          )}

          <TaskRowControls
            task={task}
            atStartCap={atStartCap}
            statusBusy={statusBusy}
            removing={removing}
            onStatusAction={statusAction}
            onMarkDone={markDone}
            onRemove={remove}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * The board's add form. It owns the draft text, the create mutation and the submit, so a
 * keystroke renders only this form, never the board and its rows (`task-board-structure.test.ts`
 * pins it). The input's ref is the board's: the empty board's "Add a task" button and the
 * focus restore after the list empties both focus the input.
 */
function AddTaskForm({ inputRef }: { inputRef: Ref<HTMLInputElement> }) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

  const createTask = useMutation({
    ...trpc.task.create.mutationOptions(),
    onSuccess: () => {
      setNewTask("");
      queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
    },
    onError: toastMutationError("add the task"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    createTask.mutate({ text: newTask.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
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
                    onClick={() => onStatusAction(action)}
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
        className={cn(
          "relative after:absolute after:-inset-2 pointer-coarse:hidden",
          destructiveIconButton,
        )}
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
        <DropdownMenuContent className="w-64" align="end">
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
