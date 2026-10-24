// Route-level loading UI for Bot settings — see ../loading.tsx for why each dashboard route has
// one. It sits inside bot/layout.tsx, so the heading and sub-nav stay painted while the
// (sections) layout checks the session and prefetches; only the body is a skeleton.

import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";

export default function BotSettingsLoading() {
  return <BotSettingsSkeleton />;
}
