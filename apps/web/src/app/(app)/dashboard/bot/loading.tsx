// Route-level loading UI for Bot settings — see ../loading.tsx for why each dashboard route has
// one. Same skeleton the page renders until its queries resolve.

import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";

export default function BotSettingsLoading() {
  return <BotSettingsSkeleton />;
}
