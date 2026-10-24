"use client";

// One command group's on/off switch (Task or Timer commands), saved the moment it flips —
// like the mute switch, it is something a streamer reaches for mid-stream. Sends only that
// one flag (`config.updateBotSettings` takes any subset), so it never writes a page's draft.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatMutationError } from "@/lib/validation-errors";
import { trpc } from "@/utils/trpc";

export type CommandGroup = "task" | "timer";

export const COMMAND_GROUP_LABEL: Record<CommandGroup, string> = {
  task: "Task commands",
  timer: "Timer commands",
};

/**
 * `enabled` is the live `config.get` value. While the save is in flight the switch shows the
 * value asked for and is disabled; the mutation waits for the refetch, so it never flickers.
 */
export function useCommandGroupSwitch(group: CommandGroup, enabled: boolean) {
  const queryClient = useQueryClient();
  const save = useMutation({
    ...trpc.config.updateBotSettings.mutationOptions(),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(
        `Couldn't switch ${COMMAND_GROUP_LABEL[group].toLowerCase()}: ${formatMutationError(err)}`,
      );
    },
  });

  const key = group === "task" ? "taskCommandsEnabled" : "timerCommandsEnabled";
  const checked = save.isPending ? (save.variables[key] ?? enabled) : enabled;

  return {
    checked,
    pending: save.isPending,
    onCheckedChange: (next: boolean) =>
      save.mutate(
        group === "task" ? { taskCommandsEnabled: next } : { timerCommandsEnabled: next },
        {
          onSuccess: () => {
            toast.success(`${COMMAND_GROUP_LABEL[group]} ${next ? "on" : "off"}`);
          },
        },
      ),
  };
}
