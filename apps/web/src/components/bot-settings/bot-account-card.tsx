"use client";

// Bot account card on the bot settings page: which Twitch account the bot speaks as, with
// Connect (a plain link into the bot OAuth flow) or Disconnect.

import { Unplug } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { TwitchIcon } from "@/components/icons/twitch-icon";
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

export function BotAccountCard({
  botAccount,
  onDisconnect,
  disconnecting,
}: {
  botAccount: { displayName: string; username: string } | null;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <CardTitle as="h2" className="font-heading text-lg font-semibold tracking-tight">
          Bot account
        </CardTitle>
        <CardAction>
          {botAccount ? (
            <StatusChip tone="live" label="Connected" />
          ) : (
            <StatusChip tone="idle" label="Not connected" />
          )}
        </CardAction>
        <CardDescription>The Twitch account that talks in your chat</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {botAccount ? (
          <>
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-twitch/15 text-twitch"
              >
                <TwitchIcon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{botAccount.displayName}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  @{botAccount.username}
                </p>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm" disabled={disconnecting}>
                    <Unplug className="size-3" />
                    Disconnect
                  </Button>
                }
                title="Disconnect the bot account?"
                description="The bot stops responding in chat immediately and DireWork asks Twitch to revoke its authorization. Any open bot page goes offline. You can reconnect the same account later."
                confirmLabel="Disconnect bot"
                onConfirm={onDisconnect}
              />
            </div>
            <p className="text-xs/relaxed text-muted-foreground">
              Mod it in your chat (
              <code className="font-mono text-foreground">/mod {botAccount.username}</code>) so slow
              mode and followers-only chat never block its replies.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No bot account connected yet. Sign in with the account the bot should chat from. Most
              streamers use a second account so replies don&apos;t post as them.
            </p>
            <Button
              size="sm"
              className="bg-twitch text-white hover:bg-twitch-hover"
              nativeButton={false}
              // A plain link, not next/link: /api/bot/authorize is a proxied route
              // handler that redirects the browser to Twitch's consent screen.
              render={<a href="/api/bot/authorize" />}
            >
              <TwitchIcon className="size-3.5" />
              Connect bot account
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
