"use client";

// Bot console card on the bot settings page: the browser page that IS the bot. Shows who
// chats where, the secret `/bot/<token>` URL with Show / Copy / Reset, the Open button, and
// the OBS steps.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { toast } from "sonner";

import { describeTrpcError } from "@/lib/trpc-errors";
import { useOrigin } from "@/lib/use-origin";
import { BotConsoleBodySkeleton } from "@/components/bot-settings-skeleton";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
import { SecretUrlRow } from "@/components/secret-url-row";
import { SectionGroup } from "@/components/section-group";
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

  const botToken = ingestInfo.data?.botToken;
  const botPath = botToken ? `/bot/${botToken}` : null;
  // `origin` is "" during SSR/hydration (useOrigin), so the Open button starts disabled.
  const botUrl = origin && botPath ? `${origin}${botPath}` : "";
  const ready = hasBotAccount && Boolean(botToken);

  return (
    <Card className="panel-hero">
      <CardHeader className="border-b border-border/40 px-5">
        <ConsoleRule label="Console" />
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Bot console
        </CardTitle>
        <CardAction>
          <StatusChip tone={ready ? "accent" : "idle"} label={ready ? "Ready" : "Not set up"} />
        </CardAction>
        <CardDescription>
          The bot runs inside a browser page and chats while that page stays open. Its URL is a
          secret: treat it like a stream key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {!hasBotAccount ? (
          <p className="text-sm text-muted-foreground">
            Connect a bot account to activate the console.
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

            <SecretUrlRow
              label="Bot page"
              path={botPath}
              onRegenerate={() => regenerateBotToken.mutate()}
              regenerating={regenerateBotToken.isPending}
              resetDescription="The current bot page URL and the Twitch chat login it was given stop working immediately. Any OBS browser source or pinned tab running the bot goes offline until you open the new URL."
            />

            <div>
              <Button
                nativeButton={false}
                render={<a href={botUrl || "#"} target="_blank" rel="noopener noreferrer" />}
                disabled={!botUrl}
              >
                <ExternalLink className="size-3.5" />
                Open bot page
              </Button>
            </div>

            <SectionGroup
              title="How to run it in OBS"
              icon={<MonitorPlay className="size-4 text-primary" aria-hidden />}
              defaultOpen={false}
              flush
            >
              <ol className="list-decimal space-y-1.5 py-3 pr-3 pl-8 text-xs/relaxed text-muted-foreground">
                <li>
                  Add a <span className="text-foreground">Browser</span> source and paste the bot
                  page URL. Don&apos;t pick &quot;Local file&quot;.
                </li>
                <li>Set it to 400 × 200. It can sit anywhere, even off the canvas.</li>
                <li>
                  Leave &quot;Shutdown source when not visible&quot; unchecked, so the bot keeps
                  running when you switch scenes.
                </li>
                <li>
                  No OBS? Keep the page open in a pinned browser tab instead. The bot only runs
                  while the page is open.
                </li>
              </ol>
            </SectionGroup>
          </>
        )}
      </CardContent>
    </Card>
  );
}
