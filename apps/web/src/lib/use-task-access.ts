"use client";

// "Who can add tasks" (bot_config.task_access), saved the moment it changes like the command
// group switches. Sends only `taskAccess` (`config.updateBotSettings` takes any subset), so it
// never writes a page's draft.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { TASK_ACCESS_LEVELS, type TaskAccessLevel } from "@dirework/api/bot-permissions";

import { formatMutationError } from "@/lib/validation-errors";
import { trpc } from "@/utils/trpc";

export { TASK_ACCESS_LEVELS, type TaskAccessLevel };

export const TASK_ACCESS_LABEL: Record<TaskAccessLevel, string> = {
  everyone: "Everyone",
  followers: "Followers",
  subscribers: "Subscribers",
  vips: "VIPs and mods",
};

/** The sentence under the picker. Mods and the streamer can always add tasks. */
export const TASK_ACCESS_DESCRIPTION: Record<TaskAccessLevel, string> = {
  everyone: "Any viewer can add tasks with !task and !next.",
  followers: "Followers, subscribers, VIPs and mods can add tasks. The bot must be a mod.",
  subscribers: "Subscribers, VIPs and mods can add tasks.",
  vips: "Only VIPs and mods can add tasks.",
};

export function isTaskAccessLevel(value: unknown): value is TaskAccessLevel {
  return (TASK_ACCESS_LEVELS as readonly unknown[]).includes(value);
}

/**
 * `level` is the live `config.get` value. While the save is in flight the picker shows the
 * level asked for and is disabled; the mutation waits for the refetch, so it never flickers.
 */
export function useTaskAccess(level: TaskAccessLevel) {
  const queryClient = useQueryClient();
  const save = useMutation({
    ...trpc.config.updateBotSettings.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() }),
    onError: (err) => {
      toast.error(`Couldn't change who can add tasks: ${formatMutationError(err)}`);
    },
  });

  const value = save.isPending ? (save.variables.taskAccess ?? level) : level;

  return {
    value,
    pending: save.isPending,
    onChange: (next: unknown) => {
      if (!isTaskAccessLevel(next) || next === value) return;
      save.mutate(
        { taskAccess: next },
        {
          onSuccess: () => {
            toast.success(`Who can add tasks: ${TASK_ACCESS_LABEL[next]}`);
          },
        },
      );
    },
  };
}
