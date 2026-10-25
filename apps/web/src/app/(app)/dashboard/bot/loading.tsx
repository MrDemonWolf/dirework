// Route-level loading UI for Bot settings — see ../loading.tsx for why each dashboard route has
// one. It sits inside bot/layout.tsx, so the heading and sub-nav stay painted while the
// (sections) layout checks the session and streams its batch; only the body is a skeleton.
// Client navigation only: a hard load holds the shell for that layout (lib/shell-hold.ts).

import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";

export default function BotSettingsLoading() {
  return <BotSettingsSkeleton />;
}
