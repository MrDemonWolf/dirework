"use client";

// Slim full-width bar at the top of the bot settings page: the bot's mute switch. Saves on
// flip (no Save bar): muting is an on-stream action, and the same switch a mod flips with
// !mute / !unmute in chat.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { describeTrpcError } from "@/lib/trpc-errors";
import { StatusChip } from "@/components/status-chip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/utils/trpc";

/** `muted` is the live `config.get` value; the switch shows the pending value while saving. */
export function BotMuteBar({ muted }: { muted: boolean }) {
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

  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <StatusChip
        tone={checked ? "warn" : "live"}
        label={checked ? "Muted" : "Live"}
        pulse={checked}
      />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        {checked
          ? "The bot ignores every command and posts nothing until it's unmuted here or a mod sends !unmute."
          : "The bot answers chat commands. Mute it to pause everything without closing the bot page."}
      </p>
      <div className="flex items-center gap-2.5">
        <Label htmlFor="bot-muted-toggle" className="console-label">
          Muted
        </Label>
        <Switch
          id="bot-muted-toggle"
          checked={checked}
          disabled={setBotMuted.isPending}
          onCheckedChange={(next) => setBotMuted.mutate({ muted: next })}
        />
      </div>
    </div>
  );
}
