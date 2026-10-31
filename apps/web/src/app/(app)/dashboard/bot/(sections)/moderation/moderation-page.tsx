"use client";

// Bot settings → Moderation (/dashboard/bot/moderation): the block list, how bans clear a
// viewer's tasks, and the mod-only chat commands. Blocking and unblocking save immediately
// (no Save bar).

import { BAN_CLEANUP_DELAY_MS } from "@dirework/api/bot-permissions";

import { moderationCommands } from "@/lib/command-rows";
import { BlockedViewersCard } from "@/components/bot-settings/blocked-viewers-card";
import { CommandReference } from "@/components/bot-settings/command-reference";
import { BlockedViewersPlaceholder } from "@/components/bot-settings-skeleton";
import { Callout } from "@/components/ui/callout";
import { BotSection, useBotConfig } from "../bot-data";

const BAN_DELAY_MINUTES = Math.round(BAN_CLEANUP_DELAY_MS / 60_000);

/** Only the block list reads `config.get`; the command reference beside it is static. */
export default function ModerationPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="space-y-6">
        <BotSection needs={["config"]} fallback={<BlockedViewersPlaceholder />}>
          <BlockedViewers />
        </BotSection>
        <BanCleanupCallout />
      </div>
      <CommandReference title="Mod commands in chat" commands={moderationCommands} />
    </div>
  );
}

/** How bans clear tasks (bot page, BAN_CLEANUP_DELAY_MS after a ban; timeouts never). */
function BanCleanupCallout() {
  return (
    <Callout
      variant="info"
      title={`Bans clear a viewer's tasks after ${BAN_DELAY_MINUTES} minutes`}
    >
      When a viewer is banned, the open bot page removes their tasks {BAN_DELAY_MINUTES} minutes
      later, unless they chat again first (they were unbanned) or a timeout replaces the ban.
      Timeouts keep their tasks. If the bot page closes before then, the tasks stay; clear them with
      !clear @user.
    </Callout>
  );
}

function BlockedViewers() {
  return <BlockedViewersCard blockedViewers={useBotConfig().botConfig.blockedViewers} />;
}
