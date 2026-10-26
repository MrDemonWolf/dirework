"use client";

// "Live controls" on the Bot settings Overview: the switches a streamer reaches for mid-stream
// (mute, Task commands, Timer commands), who can add tasks, and the block list's size. Every
// control saves the moment it changes (no Save bar). The mute chip reports the switch (Off, Muted, Unmuted),
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
import {
  TASK_ACCESS_DESCRIPTION,
  TASK_ACCESS_LABEL,
  TASK_ACCESS_LEVELS,
  type TaskAccessLevel,
  useTaskAccess,
} from "@/lib/use-task-access";
import { StatusChip } from "@/components/status-chip";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const TASK_ACCESS_ITEMS = TASK_ACCESS_LEVELS.map((level) => ({
  value: level,
  label: TASK_ACCESS_LABEL[level],
}));

/**
 * "Who can add tasks": a picker that saves on change. At Followers, a bot connected before
 * the follower check existed can't ask Twitch, so every non-follow-exempt viewer is refused
 * until it is reconnected: the callout below says so and links straight to the reconnect.
 */
function TaskAccessRow({
  level,
  followerCheckNeedsReconnect,
}: {
  level: TaskAccessLevel;
  followerCheckNeedsReconnect: boolean;
}) {
  const access = useTaskAccess(level);
  const id = "task-access-select";
  return (
    <li className="space-y-3 py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium">
            Who can add tasks
          </Label>
          <p className="text-sm text-muted-foreground">{TASK_ACCESS_DESCRIPTION[access.value]}</p>
        </div>
        <div className="shrink-0">
          <Select
            items={TASK_ACCESS_ITEMS}
            value={access.value}
            onValueChange={access.onChange}
            disabled={access.pending}
          >
            <SelectTrigger id={id} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_ACCESS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value} className="text-sm">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {access.value === "followers" && followerCheckNeedsReconnect && (
        <Callout variant="destructive" title="Reconnect the bot to allow follower checks">
          The bot account was connected before DireWork could check follows, so viewers can&apos;t
          add tasks yet.{" "}
          <a
            href="/api/bot/authorize"
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            Reconnect the bot
          </a>{" "}
          with the same account, and make sure it&apos;s a mod in your chat.
        </Callout>
      )}
    </li>
  );
}

/**
 * `muted`, the two group flags, `taskAccess` and `blockedCount` are live `config.get` values,
 * never a draft. The mute switch stays usable without a bot account, so a streamer can
 * pre-mute. `followerCheckNeedsReconnect` comes from `user.me` (the bot account lacks the
 * follower scope).
 */
export function BotLiveControls({
  muted,
  taskCommandsEnabled,
  timerCommandsEnabled,
  taskAccess,
  blockedCount,
  hasBotAccount,
  followerCheckNeedsReconnect,
}: {
  muted: boolean;
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  taskAccess: TaskAccessLevel;
  blockedCount: number;
  hasBotAccount: boolean;
  followerCheckNeedsReconnect: boolean;
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
        <CardDescription>Each control takes effect as soon as you change it.</CardDescription>
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
          <TaskAccessRow
            level={taskAccess}
            followerCheckNeedsReconnect={followerCheckNeedsReconnect}
          />
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
