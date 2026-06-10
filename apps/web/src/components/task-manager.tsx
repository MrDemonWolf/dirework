"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { Check, Focus, ListTodo, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/utils/trpc";

interface TaskManagerProps {
  userTwitchId: string;
  username: string;
  displayName: string;
  /** Overlay tasks token — enables live SSE sync (chat commands show up instantly). */
  overlayToken?: string | null;
}

interface TaskGroup {
  authorTwitchId: string;
  authorDisplayName: string;
  authorColor: string | null;
  tasks: Array<{ id: string; text: string; status: string; authorTwitchId: string; authorDisplayName: string; authorColor: string | null }>;
}

function groupTasksByAuthor(
  tasks: Array<{ id: string; text: string; status: string; authorTwitchId: string; authorDisplayName: string; authorColor: string | null }>,
): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    let group = groups.get(task.authorTwitchId);
    if (!group) {
      group = {
        authorTwitchId: task.authorTwitchId,
        authorDisplayName: task.authorDisplayName,
        authorColor: task.authorColor,
        tasks: [],
      };
      groups.set(task.authorTwitchId, group);
    }
    group.tasks.push(task);
  }
  return Array.from(groups.values());
}

export function TaskManager({
  userTwitchId,
  username,
  displayName,
  overlayToken,
}: TaskManagerProps) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);
  const [activatingTaskId, setActivatingTaskId] = useState<string | null>(null);

  const tasks = useQuery({
    ...trpc.task.list.queryOptions(),
    // SSE keeps this fresh when a token is available; polling is the fallback
    refetchInterval: overlayToken ? 30000 : 3000,
  });

  // Live sync: any task change (dashboard, chat command, bot) pushes an SSE
  // event — refetch the list so the manager mirrors the overlay instantly.
  useSubscription({
    ...trpc.overlay.onTaskList.subscriptionOptions({ token: overlayToken ?? "" }),
    enabled: Boolean(overlayToken),
    onData: () => {
      queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
  };

  const createTask = useMutation({
    ...trpc.task.create.mutationOptions(),
    onSuccess: () => {
      setNewTask("");
      invalidate();
    },
  });

  const markDone = useMutation({
    ...trpc.task.markDone.mutationOptions(),
    onSuccess: invalidate,
  });

  const activateTask = useMutation({
    ...trpc.task.activate.mutationOptions(),
    onSuccess: invalidate,
  });

  const removeTask = useMutation({
    ...trpc.task.remove.mutationOptions(),
    onSuccess: invalidate,
  });

  const clearAll = useMutation({
    ...trpc.task.clearAll.mutationOptions(),
    onSuccess: invalidate,
  });

  const clearDone = useMutation({
    ...trpc.task.clearDone.mutationOptions(),
    onSuccess: invalidate,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    createTask.mutate({
      authorTwitchId: userTwitchId,
      authorUsername: username,
      authorDisplayName: displayName,
      text: newTask.trim(),
    });
  };

  const taskList = tasks.data ?? [];
  const activeCount = taskList.filter((t) => t.status === "active").length;
  const pendingCount = taskList.filter((t) => t.status === "pending" || t.status === "active").length;
  const doneCount = taskList.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-4">
      {/* Add task form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a task..."
          maxLength={500}
          disabled={createTask.isPending}
          aria-label="New task text"
        />
        <Button type="submit" disabled={!newTask.trim() || createTask.isPending}>
          Add
        </Button>
      </form>

      {/* Stats + bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {pendingCount} pending
          </span>
          {doneCount > 0 && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {doneCount} done
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {doneCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clearDone.mutate()}
              disabled={clearDone.isPending}
            >
              Clear done
            </Button>
          )}
          {taskList.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Task list grouped by author */}
      <div className="max-h-[400px] space-y-3 overflow-y-auto">
        {taskList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="rounded-2xl bg-primary/10 p-3.5">
              <ListTodo className="size-6 text-primary" />
            </div>
            <div className="max-w-[15rem] text-center">
              <p className="text-sm font-medium">A clean slate</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add the first task above — or let chat kick things off with{" "}
                <code className="rounded bg-muted px-1 py-0.5">!task</code>.
              </p>
            </div>
          </div>
        ) : (
          groupTasksByAuthor(taskList).map((group) => {
            const groupPending = group.tasks.filter((t) => t.status === "pending" || t.status === "active").length;
            const groupDone = group.tasks.filter((t) => t.status === "done").length;
            return (
              <div key={group.authorTwitchId} className="space-y-1">
                {/* Author header */}
                <div className="flex items-center gap-2 px-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: group.authorColor || undefined }}
                  >
                    {group.authorDisplayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {groupPending} pending
                    {groupDone > 0 && ` · ${groupDone} done`}
                  </span>
                </div>
                {group.tasks.map((task) => {
                  const isDone = task.status === "done";
                  const isActive = task.status === "active";
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-2 py-1.5 pl-4 hover:bg-muted/50",
                        isDone && "opacity-60",
                        isActive && "ring-2 ring-primary/60 shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.4)] animate-pulse",
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => (isActive || task.status === "pending") && markDone.mutate({ id: task.id })}
                        disabled={isDone || markDone.isPending}
                        aria-label={isDone ? `${task.text} (done)` : `Mark "${task.text}" as done`}
                        className={cn(
                          "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
                          isDone
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 hover:border-primary disabled:hover:border-muted-foreground/40",
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

                      {/* Activate button (hover reveal, pending tasks only) */}
                      {!isDone && !isActive && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setActivatingTaskId(task.id);
                                  activateTask.mutate(
                                    { id: task.id },
                                    { onSettled: () => setActivatingTaskId(null) },
                                  );
                                }}
                                disabled={activatingTaskId === task.id}
                                aria-label={`Set "${task.text}" as active`}
                                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                              />
                            }
                          >
                            <Focus className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent>Set as active</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Remove button (hover reveal) */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setRemovingTaskId(task.id);
                          removeTask.mutate(
                            { id: task.id },
                            { onSettled: () => setRemovingTaskId(null) },
                          );
                        }}
                        disabled={removingTaskId === task.id}
                        aria-label={`Remove "${task.text}"`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
