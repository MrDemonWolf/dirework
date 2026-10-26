"use client";

// Bot settings → Moderation (/dashboard/bot/moderation): the block list, how bans clear a
// viewer's tasks, and the mod-only chat commands. Blocking and unblocking save immediately
// (no Save bar).

import { BAN_CHECK_SCOPE, BAN_CLEANUP_DELAY_MS } from "@dirework/api/bot-permissions";

import { moderationCommands } from "@/lib/command-rows";
import { BlockedViewersCard } from "@/components/bot-settings/blocked-viewers-card";
import { CommandReference } from "@/components/bot-settings/command-reference";
import { BlockedViewersPlaceholder } from "@/components/bot-settings-skeleton";
import { Callout } from "@/components/ui/callout";
import { BotSection, useBotConfig, useBotUser } from "../bot-data";

const BAN_DELAY_MINUTES = Math.round(BAN_CLEANUP_DELAY_MS / 60_000);

/** Only the block list reads `config.get`; the command reference beside it is static. */
export default function ModerationPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="space-y-6">
        <BotSection needs={["config"]} fallback={<BlockedViewersPlaceholder />}>
          <BlockedViewers />
        </BotSection>
        {/* The note on confirming bans needs `user.me`; until then, the same callout without it. */}
        <BotSection needs={["user"]} fallback={<BanCleanupCallout />}>
          <BanCleanupCallout note={<BanCheckNote />} />
        </BotSection>
      </div>
      <CommandReference title="Mod commands in chat" commands={moderationCommands} />
    </div>
  );
}

/** How bans clear tasks (bot page, BAN_CLEANUP_DELAY_MS after a ban; timeouts never). */
function BanCleanupCallout({ note }: { note?: React.ReactNode }) {
  return (
    <Callout
      variant="info"
      title={`Bans clear a viewer's tasks after ${BAN_DELAY_MINUTES} minutes`}
    >
      When a viewer is banned, the open bot page removes their tasks {BAN_DELAY_MINUTES} minutes
      later, unless they chat again first (they were unbanned). Timeouts keep their tasks. If the
      bot page closes before then, the tasks stay; clear them with !clear @user. {note}
    </Callout>
  );
}

function BlockedViewers() {
  return <BlockedViewersCard blockedViewers={useBotConfig().botConfig.blockedViewers} />;
}

/**
 * Twitch answers "is this viewer still banned?" only for the channel's own account, so the
 * check (and the hint to reconnect for it) applies only to a bot that IS the streamer.
 */
function BanCheckNote() {
  const bot = useBotUser().botAccount;
  if (!bot?.isChannelAccount) return null;
  return bot.missingScopes.includes(BAN_CHECK_SCOPE) ? (
    <>
      <a
        href="/api/bot/authorize"
        className="font-medium text-link underline-offset-4 hover:underline"
      >
        Reconnect the bot
      </a>{" "}
      to have DireWork confirm the ban with Twitch first.
    </>
  ) : (
    "DireWork confirms the ban with Twitch first."
  );
}
