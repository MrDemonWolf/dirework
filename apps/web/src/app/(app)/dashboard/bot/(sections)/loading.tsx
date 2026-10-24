// Shown the instant a sub-nav link is followed, while the next sub-page renders (the session
// and data are already in hand from the layout above, so that is a web-worker render only).

import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";

export default function BotSectionLoading() {
  return <BotSettingsSkeleton />;
}
