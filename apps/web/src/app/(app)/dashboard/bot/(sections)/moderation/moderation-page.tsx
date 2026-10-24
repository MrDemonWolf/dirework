"use client";

// Bot settings → Moderation (/dashboard/bot/moderation): the block list and the mod-only
// chat commands. Blocking and unblocking save immediately (no Save bar).

import { BlockedViewersCard } from "@/components/bot-settings/blocked-viewers-card";
import { useBotData } from "../bot-data";

export default function ModerationPage() {
  const { config } = useBotData();
  return <BlockedViewersCard blockedViewers={config.botConfig.blockedViewers} />;
}
