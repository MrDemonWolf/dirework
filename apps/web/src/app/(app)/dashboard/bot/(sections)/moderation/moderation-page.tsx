"use client";

// Bot settings → Moderation (/dashboard/bot/moderation): the block list and the mod-only
// chat commands. Blocking and unblocking save immediately (no Save bar).

import { moderationCommands } from "@/lib/command-rows";
import { BlockedViewersCard } from "@/components/bot-settings/blocked-viewers-card";
import { CommandReference } from "@/components/bot-settings/command-reference";
import { BlockedViewersPlaceholder } from "@/components/bot-settings-skeleton";
import { BotSection, useBotConfig } from "../bot-data";

/** Only the block list reads `config.get`; the command reference beside it is static. */
export default function ModerationPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <BotSection needs={["config"]} fallback={<BlockedViewersPlaceholder />}>
        <BlockedViewers />
      </BotSection>
      <CommandReference title="Mod commands in chat" commands={moderationCommands} />
    </div>
  );
}

function BlockedViewers() {
  return <BlockedViewersCard blockedViewers={useBotConfig().botConfig.blockedViewers} />;
}
