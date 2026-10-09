"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Focus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_TASK_LEN } from "@/lib/config-types";
import { DASHBOARD_TASKS_POLL_MS, dashboardPollInterval } from "@/lib/poll-intervals";
import { groupTasksByAuthor } from "@/lib/task-utils";
import { StatusChip } from "@/components/status-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

interface TaskManagerProps {
  userTwitchId: string;
  /** Overlay preview, rendered beside the add-task + list body (mirrors the timer console). */
  preview?: ReactNode;
}

/**
 * The Task Board panel — renders the full panel content (header with count
 * cluster, add form, author group cards, footer strip). The parent supplies
 * the `.panel` chrome.
 */
export function TaskManager({ userTwitchId, preview }: TaskManagerProps) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

  const tasks = useQuery({
    ...trpc.task.list.queryOptions(),
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

  const activateTask = useMutation({
    ...trpc.task.activate.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("set the active task"),
  });

  const removeTask = useMutation({
    ...trpc.task.remove.mutationOptions(),
    onSuccess: invalidate,
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

  // Removing a task unmounts its row, and activating one unmounts its Activate
  // button — either drops keyboard focus to <body>. Once the list reflects the
  // change, move focus somewhere sensible (only if it was actually lost).
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<
    | { kind: "remove"; taskId: string; nextId: string | null }
    | { kind: "activate"; taskId: string }
    | null
  >(null);

  useEffect(() => {
    const pending = pendingFocus.current;
    const data = tasks.data?.tasks;
    if (!pending || !data) return;
    const task = data.find((t) => t.id === pending.taskId);
    const settled = pending.kind === "remove" ? !task : task?.status === "active";
    if (!settled) return;
    pendingFocus.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const targetId = pending.kind === "remove" ? pending.nextId : pending.taskId;
    const target = targetId
      ? listRef.current?.querySelector<HTMLElement>(`[data-remove-task="${CSS.escape(targetId)}"]`)
      : null;
    (target ?? addInputRef.current)?.focus();
  }, [tasks.data]);

  // Counts come from the server: the list carries only the newest done tasks
  // (DONE_TASK_LIST_LIMIT), so counting the array would undercount "Done".
  const pendingCount = tasks.data?.counts.open ?? 0;
  const doneCount = tasks.data?.counts.done ?? 0;
  const totalCount = pendingCount + doneCount;

  // Broadcaster group pins first; viewer groups keep list order.
  const groups = groupTasksByAuthor(taskList);
  const orderedGroups = [
    ...groups.filter((g) => g.authorKey === userTwitchId),
    ...groups.filter((g) => g.authorKey !== userTwitchId),
  ];
  const orderedTaskIds = orderedGroups.flatMap((g) => g.tasks.map((t) => t.id));

  /** The row that takes focus after `taskId` is removed: the next one, else the previous. */
  const neighborTaskId = (taskId: string) => {
    const index = orderedTaskIds.indexOf(taskId);
    return orderedTaskIds[index + 1] ?? orderedTaskIds[index - 1] ?? null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Panel header: kicker rule + title + count cluster */}
      <div className="border-b border-border/40 px-5 pt-4 pb-3">
        <ConsoleRule label="Task Board" />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Yours and chat&apos;s, grouped by author
            </p>
          </div>
          <div className="flex gap-5">
            <div className="text-right">
              <p className="font-mono text-2xl tabular-nums">{pendingCount}</p>
              <p className="console-label">Open</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl tabular-nums">{doneCount}</p>
              <p className="console-label">Done</p>
            </div>
          </div>
        </div>
      </div>

      {/* Board body + overlay preview, side by side and top-aligned — mirrors the
          timer console (settings | preview) so the preview sits beside the
          add-task block instead of ballooning down the full list height. */}
      <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col">
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
                className="h-10"
              />
              <Button
                type="submit"
                disabled={!newTask.trim() || createTask.isPending}
                className="h-10 px-4"
              >
                Add
              </Button>
            </form>

            <div ref={listRef} className="max-h-[400px] space-y-3 overflow-y-auto">
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
                      className="stroke-primary/60"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="30 96"
                      transform="rotate(-90 24 24)"
                    />
                  </svg>
                  <div className="max-w-[15rem] text-center">
                    <p className="text-sm font-medium">A clean slate</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add the first task above — or let chat kick things off with{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">!task</code>.
                    </p>
                  </div>
                </div>
              ) : (
                orderedGroups.map((group) => {
                  const isHost = group.authorKey === userTwitchId;
                  return (
                    <div
                      key={group.authorKey}
                      className="overflow-hidden rounded-xl border border-border/40 bg-muted/20"
                    >
                      {/* Author header — Twitch color only ever tints the dot */}
                      <div className="flex items-center gap-2 border-b border-border/40 bg-muted/40 px-3 py-2">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background: isHost
                              ? "var(--primary)"
                              : (group.authorColor ?? "var(--chart-2)"),
                          }}
                        />
                        <span className="truncate text-sm font-medium">
                          {group.authorDisplayName}
                        </span>
                        {isHost && <StatusChip size="sm" tone="accent" label="Host" />}
                        <span className="console-label ml-auto shrink-0">
                          {group.done}/{group.tasks.length}
                        </span>
                      </div>
                      <ul className="divide-y divide-border/40">
                        {group.tasks.map((task) => {
                          const isDone = task.status === "done";
                          const isActive = task.status === "active";
                          return (
                            <li
                              key={task.id}
                              className={cn(
                                "group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40",
                                isActive && "-ml-px border-l-2 border-l-primary bg-primary/5",
                              )}
                            >
                              {/* Checkbox */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!(isActive || task.status === "pending")) return;
                                  if (markDone.isPending && markDone.variables?.id === task.id)
                                    return;
                                  markDone.mutate({ id: task.id });
                                }}
                                // aria-disabled (not disabled) so the control keeps
                                // keyboard focus while pending and once done.
                                aria-disabled={
                                  isDone ||
                                  (markDone.isPending && markDone.variables?.id === task.id)
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

                              {/* Task text */}
                              <p
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  isDone && "text-muted-foreground line-through",
                                )}
                              >
                                {task.text}
                              </p>

                              {isActive && (
                                <StatusChip
                                  size="sm"
                                  tone="accent"
                                  label="Active"
                                  pulse
                                  className="shrink-0"
                                />
                              )}

                              {/* Activate button (always visible on touch, hover reveal on pointer) */}
                              {!isDone && !isActive && (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => {
                                          pendingFocus.current = {
                                            kind: "activate",
                                            taskId: task.id,
                                          };
                                          activateTask.mutate(
                                            { id: task.id },
                                            {
                                              onError: () => {
                                                pendingFocus.current = null;
                                              },
                                            },
                                          );
                                        }}
                                        disabled={
                                          activateTask.isPending &&
                                          activateTask.variables?.id === task.id
                                        }
                                        focusableWhenDisabled
                                        aria-label={`Set "${task.text}" as active`}
                                        className="relative opacity-100 transition-opacity after:absolute after:-inset-2 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                      />
                                    }
                                  >
                                    <Focus className="size-3" />
                                  </TooltipTrigger>
                                  <TooltipContent>Set as active</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Remove button (always visible on touch, hover reveal on pointer) */}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  pendingFocus.current = {
                                    kind: "remove",
                                    taskId: task.id,
                                    nextId: neighborTaskId(task.id),
                                  };
                                  removeTask.mutate(
                                    { id: task.id },
                                    {
                                      onError: () => {
                                        pendingFocus.current = null;
                                      },
                                    },
                                  );
                                }}
                                disabled={
                                  removeTask.isPending && removeTask.variables?.id === task.id
                                }
                                focusableWhenDisabled
                                data-remove-task={task.id}
                                aria-label={`Remove "${task.text}"`}
                                className="relative text-destructive opacity-100 transition-opacity after:absolute after:-inset-2 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer strip: bulk actions behind confirms */}
          {taskList.length > 0 && (
            <div className="flex items-center justify-end gap-1 border-t border-border/40 px-3 py-2">
              <p className="mr-auto text-xs text-muted-foreground">
                Done tasks clear automatically after 24h
              </p>
              {doneCount > 0 && (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={clearDone.isPending}
                    >
                      Clear done
                    </Button>
                  }
                  title="Clear done tasks?"
                  description={`This permanently removes ${doneCount} completed ${doneCount === 1 ? "task" : "tasks"} from the list and the overlay.`}
                  confirmLabel="Clear done"
                  onConfirm={() => clearDone.mutate()}
                />
              )}
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={clearAll.isPending}
                  >
                    Clear all
                  </Button>
                }
                title="Clear every task?"
                description={`This permanently removes all ${totalCount} ${totalCount === 1 ? "task" : "tasks"} — including viewer tasks — from the list and the overlay. Chat will need to re-add theirs.`}
                confirmLabel="Clear all tasks"
                onConfirm={() => clearAll.mutate()}
              />
            </div>
          )}
        </div>
        {preview && (
          <div className="w-full border-t border-border/40 p-5 lg:w-72 lg:shrink-0 lg:border-t-0 lg:border-l lg:border-border/40">
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}
