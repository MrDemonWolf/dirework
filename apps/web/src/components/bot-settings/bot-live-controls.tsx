"use client";

// "Live controls" on the Bot settings Overview: the switches a streamer reaches for mid-stream
// (mute, Task commands, Timer commands) and the block list's size. Every switch saves the
// moment it flips (no Save bar). The mute chip reports the switch (Off, Muted, Unmuted),
// never that the bot is running: that depends on its bot page being open.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { MAX_BLOCKED_VIEWERS } from "@dirework/api/chat-commands";

import { botMuteStatus } from "@/lib/bot-status";
import { describeTrpcError } from "@/lib/trpc-errors";
import {
  type CommandGroup,
  COMMAND_GROUP_LABEL,
  useCommandGroupSwitch,
} from "@/lib/use-command-group-switch";
import { StatusChip } from "@/components/status-chip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/utils/trpc";

/** One row: what the control does on the left, the control on the right. */
function ControlRow({
  htmlFor,
  label,
  trailingLabel,
  description,
  control,
}: {
  htmlFor?: string;
  label: string;
  trailingLabel?: React.ReactNode;
  description: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {htmlFor ? (
            <Label htmlFor={htmlFor} className="text-sm font-medium">
              {label}
            </Label>
          ) : (
            <p className="text-sm font-medium">{label}</p>
          )}
          {trailingLabel}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </li>
  );
}

const GROUP_DESCRIPTION: Record<CommandGroup, { on: string; off: string }> = {
  task: {
    on: "Viewers add and finish their tasks from chat.",
    off: "The bot ignores task commands. !dw help still answers.",
  },
  timer: {
    on: "Mods start, pause and skip the timer from chat.",
    off: "The bot ignores timer commands.",
  },
};

function CommandGroupRow({ group, enabled }: { group: CommandGroup; enabled: boolean }) {
  const toggle = useCommandGroupSwitch(group, enabled);
  const id = `${group}-commands-live-toggle`;
  return (
    <ControlRow
      htmlFor={id}
      label={COMMAND_GROUP_LABEL[group]}
      description={GROUP_DESCRIPTION[group][toggle.checked ? "on" : "off"]}
      control={
        <Switch
          id={id}
          checked={toggle.checked}
          disabled={toggle.pending}
          onCheckedChange={toggle.onCheckedChange}
        />
      }
    />
  );
}

/**
 * `muted`, the two group flags and `blockedCount` are live `config.get` values, never a
 * draft. The mute switch stays usable without a bot account, so a streamer can pre-mute.
 */
export function BotLiveControls({
  muted,
  taskCommandsEnabled,
  timerCommandsEnabled,
  blockedCount,
  hasBotAccount,
}: {
  muted: boolean;
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  blockedCount: number;
  hasBotAccount: boolean;
}) {
  const queryClient = useQueryClient();
  const setBotMuted = useMutation({
    ...trpc.config.setBotMuted.mutationOptions(),
    // Returning the refetch keeps the mutation pending until config.get has the new value,
    // so the optimistic switch below never flickers back.
    onSuccess: ({ muted: next }) => {
      toast.success(next ? "Bot muted" : "Bot unmuted");
      return queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
    onError: (err) => {
      toast.error(`Couldn't change the mute switch: ${describeTrpcError(err)}`);
    },
  });

  // Optimistic: while the request is in flight, show what was asked for.
  const checked = setBotMuted.isPending ? setBotMuted.variables.muted : muted;
  const status = botMuteStatus({ muted: checked, hasBotAccount });

  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Live controls
        </CardTitle>
        <CardDescription>Each switch takes effect as soon as you flip it.</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ul className="divide-y divide-border/40">
          <ControlRow
            htmlFor="bot-muted-toggle"
            label="Mute bot"
            trailingLabel={
              <StatusChip tone={status.tone} label={status.label} pulse={status.pulse} size="sm" />
            }
            description={status.description}
            control={
              <Switch
                id="bot-muted-toggle"
                checked={checked}
                disabled={setBotMuted.isPending}
                onCheckedChange={(next) => setBotMuted.mutate({ muted: next })}
              />
            }
          />
          <CommandGroupRow group="task" enabled={taskCommandsEnabled} />
          <CommandGroupRow group="timer" enabled={timerCommandsEnabled} />
          <ControlRow
            label="Blocked viewers"
            description={
              blockedCount === 0
                ? "Nobody is blocked."
                : `${blockedCount} of ${MAX_BLOCKED_VIEWERS} blocked`
            }
            control={
              <Link
                href="/dashboard/bot/moderation"
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Manage
              </Link>
            }
          />
        </ul>
      </CardContent>
    </Card>
  );
}
