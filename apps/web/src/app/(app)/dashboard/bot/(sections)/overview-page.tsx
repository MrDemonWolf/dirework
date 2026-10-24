"use client";

// Bot settings Overview (/dashboard/bot): the live switches, how to run the bot (its secret
// page URL), and the bot account. Nothing here goes through a Save bar. The bot OAuth flow
// returns here with `?bot=` status params. Without a bot account, connecting one is the
// first thing on the page.

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { botOAuthErrorMessage } from "@dirework/api/config-shared";

import { describeTrpcError } from "@/lib/trpc-errors";
import { BotAccountCard } from "@/components/bot-settings/bot-account-card";
import { BotConsoleCard } from "@/components/bot-settings/bot-console-card";
import { BotLiveControls } from "@/components/bot-settings/bot-live-controls";
import { trpc } from "@/utils/trpc";
import { useBotData } from "./bot-data";

export default function BotOverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { config, user } = useBotData();

  // Handle bot connection callback params (set by the api's /api/bot/callback/twitch
  // redirect), then strip them so a refresh doesn't re-toast.
  useEffect(() => {
    const botStatus = searchParams.get("bot");
    if (botStatus === "connected") {
      toast.success("Bot account connected");
      router.replace("/dashboard/bot");
    } else if (botStatus === "cancelled") {
      toast("Bot connection cancelled");
      router.replace("/dashboard/bot");
    } else if (botStatus === "error") {
      // Map the code to fixed copy — never render the raw query param.
      toast.error(botOAuthErrorMessage(searchParams.get("reason")));
      router.replace("/dashboard/bot");
    }
  }, [searchParams, router]);

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: ({ revoked }) => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      if (revoked) {
        toast.success("Bot account disconnected");
      } else {
        toast.warning("Bot account disconnected, but Twitch didn't confirm the revocation", {
          description:
            "Remove DireWork from the bot account's connections at twitch.tv/settings/connections.",
        });
      }
    },
    onError: (err) => {
      toast.error(`Couldn't disconnect the bot account: ${describeTrpcError(err)}`);
    },
  });

  const botAccount = user.botAccount ?? null;
  const bot = config.botConfig;
  const accountCard = (
    <BotAccountCard
      botAccount={botAccount}
      onDisconnect={() => disconnectBot.mutate()}
      disconnecting={disconnectBot.isPending}
    />
  );

  return (
    <div className="space-y-6">
      {/* Nothing answers chat until a bot account is connected, so that comes first. */}
      {!botAccount && accountCard}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <BotLiveControls
            muted={bot.muted}
            taskCommandsEnabled={bot.taskCommandsEnabled}
            timerCommandsEnabled={bot.timerCommandsEnabled}
            blockedCount={bot.blockedViewers.length}
            hasBotAccount={botAccount !== null}
          />
          {botAccount && accountCard}
        </div>
        <BotConsoleCard hasBotAccount={botAccount !== null} />
      </div>
    </div>
  );
}
