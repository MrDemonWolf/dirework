"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListTodo, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";

interface TaskManagerProps {
  userTwitchId: string;
  username: string;
  displayName: string;
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
}: TaskManagerProps) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);

  const tasks = useQuery({
    ...trpc.task.list.queryOptions(),
    refetchInterval: 3000,
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
  const pendingCount = taskList.filter((t) => t.status === "pending").length;
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
      <div className="space-y-3">
        {taskList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="rounded-full bg-muted p-3">
              <ListTodo className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-xs text-muted-foreground">
                Add one above or use <code className="rounded bg-muted px-1">!task</code> in chat
              </p>
            </div>
          </div>
        ) : (
          groupTasksByAuthor(taskList).map((group) => {
            const groupPending = group.tasks.filter((t) => t.status === "pending").length;
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
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-2 py-1.5 pl-4 hover:bg-muted/50",
                        isDone && "opacity-60",
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => !isDone && markDone.mutate({ id: task.id })}
                        disabled={isDone || markDone.isPending}
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isDone
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 hover:border-primary",
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
                        title="Remove"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
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
