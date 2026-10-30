"use client";

// "Run the bot" card on the Bot settings Overview: the browser page that IS the bot. Shows
// who chats where, then `BotPageHandoff`: the widget / dock choice, the chosen secret URL with
// Show / Copy / Reset (one token, so Reset changes both), an Open button for that view, and
// its steps.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { botConsoleStatus } from "@/lib/bot-status";
import { describeTrpcError } from "@/lib/trpc-errors";
import { useOrigin } from "@/lib/use-origin";
import { BotPageHandoff } from "@/components/bot-page-handoff";
import { BotConsoleBodySkeleton } from "@/components/bot-settings-skeleton";
import { QueryError } from "@/components/query-error";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/utils/trpc";

/**
 * A reset rotates the URL token and then tries to revoke the Twitch chat token the old page
 * was handed; the returned `chatToken` outcome picks one of the fixed toasts below.
 */
export function BotConsoleCard({ hasBotAccount }: { hasBotAccount: boolean }) {
  const queryClient = useQueryClient();
  // Without a bot account the card shows a prompt and ignores this data, so don't spend
  // the (double-billed, via /rpc) request on it.
  const ingestInfo = useQuery({
    ...trpc.bot.getIngestInfo.queryOptions(),
    enabled: hasBotAccount,
  });
  const origin = useOrigin();

  const regenerateBotToken = useMutation({
    ...trpc.bot.regenerateBotToken.mutationOptions(),
    onSuccess: ({ chatToken }) => {
      queryClient.invalidateQueries({ queryKey: trpc.bot.getIngestInfo.queryKey() });
      // The reset also un-confirmed the checklist's bot-page step (the old URL is dead).
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      // Fixed copy per outcome — never Twitch's own text.
      if (chatToken === "unconfirmed") {
        toast.warning(
          "Bot page URL reset, but Twitch didn't confirm the old chat login was revoked",
          {
            description:
              "The old URL no longer works. A copied chat login expires on its own within a few hours; to end it now, remove DireWork from the bot account's connections at twitch.tv/settings/connections, then reconnect the bot.",
          },
        );
      } else if (chatToken === "revoked") {
        toast.success("Bot page URL reset — the old URL and its Twitch chat login no longer work");
      } else {
        toast.success("Bot page URL reset — the old one no longer works");
      }
    },
    onError: (err) => {
      toast.error(`Couldn't reset the bot page URL: ${describeTrpcError(err)}`);
    },
  });

  const status = botConsoleStatus({
    hasBotAccount,
    hasBotUrl: Boolean(ingestInfo.data?.botToken),
  });

  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Run the bot
        </CardTitle>
        <CardAction>
          <StatusChip tone={status.tone} label={status.label} />
        </CardAction>
        <CardDescription>
          The bot runs inside a browser page. Its URL is a secret: treat it like a stream key.
          {/* "URL ready" can't tell whether that page is open anywhere (no polling for it). */}
          <span className="mt-1 block font-medium text-foreground">
            Runs only while its widget or dock is open: in OBS, Moblin or a browser tab.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {!hasBotAccount ? (
          <p className="text-sm text-muted-foreground">
            The bot page URL appears here once a bot account is connected.
          </p>
        ) : ingestInfo.isPending ? (
          <BotConsoleBodySkeleton />
        ) : !ingestInfo.data ? (
          <QueryError
            title="Couldn't load the bot page URL"
            onRetry={() => ingestInfo.refetch()}
            retrying={ingestInfo.isFetching}
          />
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-mono font-medium">{ingestInfo.data.botUsername ?? "—"}</span>
              <span className="text-muted-foreground">chats in</span>
              <span className="font-mono font-medium">#{ingestInfo.data.channelName ?? "—"}</span>
            </p>

            <BotPageHandoff
              botToken={ingestInfo.data.botToken}
              reset={{
                onRegenerate: () => regenerateBotToken.mutate(),
                regenerating: regenerateBotToken.isPending,
                description:
                  "The widget and dock URLs share one token, so both change. The current ones, and the Twitch chat login they were given, stop working immediately: any widget, dock or tab running the bot goes offline until you paste in the new URL.",
              }}
              renderAction={(path, mode) => {
                // `origin` is "" during SSR/hydration (useOrigin), so Open starts disabled.
                const url = origin && path ? `${origin}${path}` : "";
                return (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={url || "#"} target="_blank" rel="noopener noreferrer" />}
                      disabled={!url}
                    >
                      <ExternalLink className="size-3.5" />
                      Open {mode.urlLabel.toLowerCase()}
                    </Button>
                    {/* A blank tab would otherwise look broken. */}
                    {mode.view === "widget" && (
                      <p className="text-xs text-muted-foreground">
                        It opens blank: the tab title shows the bot&apos;s state.
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
