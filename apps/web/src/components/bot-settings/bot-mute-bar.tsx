"use client";

// Slim full-width bar at the top of the bot settings page: the bot's mute switch. Saves on
// flip (no Save bar): muting is an on-stream action, and the same switch a mod flips with
// !mute / !unmute in chat. The chip reports the switch (Off, Muted, Unmuted), never that the
// bot is running: that depends on its bot page being open.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { botMuteStatus } from "@/lib/bot-status";
import { describeTrpcError } from "@/lib/trpc-errors";
import { StatusChip } from "@/components/status-chip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/utils/trpc";

/**
 * `muted` is the live `config.get` value; the switch shows the pending value while saving.
 * The switch stays usable without a bot account, so a streamer can pre-mute.
 */
export function BotMuteBar({ muted, hasBotAccount }: { muted: boolean; hasBotAccount: boolean }) {
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

  // Below `sm` the chip and switch share the first row and the sentence takes the full width
  // under them; from `sm` up the three sit on one line.
  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <StatusChip tone={status.tone} label={status.label} pulse={status.pulse} />
      <div className="ml-auto flex items-center gap-2.5 sm:order-last">
        <Label htmlFor="bot-muted-toggle" className="console-label">
          Mute bot
        </Label>
        <Switch
          id="bot-muted-toggle"
          checked={checked}
          disabled={setBotMuted.isPending}
          onCheckedChange={(next) => setBotMuted.mutate({ muted: next })}
        />
      </div>
      <p className="w-full min-w-0 text-sm text-muted-foreground sm:w-auto sm:flex-1">
        {status.description}
      </p>
    </div>
  );
}
