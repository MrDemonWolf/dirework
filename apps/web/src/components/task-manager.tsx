"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";

interface TaskManagerProps {
  userTwitchId: string;
  username: string;
  displayName: string;
}

export function TaskManager({
  userTwitchId,
  username,
  displayName,
}: TaskManagerProps) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

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
        <p className="text-xs text-muted-foreground">
          {pendingCount} pending, {doneCount} done
        </p>
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

      {/* Task list */}
      <div className="space-y-1">
        {taskList.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No tasks yet. Add one above or use !task in chat.
          </p>
        ) : (
          taskList.map((task) => {
            const isDone = task.status === "done";
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50"
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: task.authorColor || undefined }}
                >
                  {task.authorDisplayName}
                </span>
                <span
                  className={`flex-1 truncate text-xs ${isDone ? "text-muted-foreground line-through" : ""}`}
                >
                  {task.text}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  {!isDone && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => markDone.mutate({ id: task.id })}
                      disabled={markDone.isPending}
                      title="Mark done"
                    >
                      <Check className="size-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeTask.mutate({ id: task.id })}
                    disabled={removeTask.isPending}
                    title="Remove"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
