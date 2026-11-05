"use client";

// One command group's on/off switch (Task or Timer commands), saved the moment it flips —
// like the mute switch, it is something a streamer reaches for mid-stream. Sends only that
// one flag (`config.updateBotSettings` takes any subset), so it never writes a page's draft.

import { botSettingsSaved } from "@/lib/config-cache";
import { useInstantSetting } from "@/lib/use-instant-setting";
import { trpc } from "@/utils/trpc";

export type CommandGroup = "task" | "timer";

export const COMMAND_GROUP_LABEL: Record<CommandGroup, string> = {
  task: "Task commands",
  timer: "Timer commands",
};

/**
 * `enabled` is the live `config.get` value. While the save is in flight the switch shows the
 * value asked for and is disabled (lib/use-instant-setting.ts).
 */
export function useCommandGroupSwitch(group: CommandGroup, enabled: boolean) {
  const key = group === "task" ? "taskCommandsEnabled" : "timerCommandsEnabled";
  const label = COMMAND_GROUP_LABEL[group];
  const setting = useInstantSetting({
    mutationOptions: trpc.config.updateBotSettings.mutationOptions(),
    merge: botSettingsSaved,
    live: enabled,
    pick: (sent) => sent[key],
    errorAction: `switch ${label.toLowerCase()}`,
    successText: (sent) => `${label} ${sent[key] ? "on" : "off"}`,
  });

  return {
    checked: setting.value,
    pending: setting.pending,
    onCheckedChange: (next: boolean) =>
      setting.set(
        group === "task" ? { taskCommandsEnabled: next } : { timerCommandsEnabled: next },
      ),
  };
}
