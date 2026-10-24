import type { Metadata } from "next";

import ModerationPage from "./moderation-page";

export const metadata: Metadata = { title: "Bot moderation" };

/** Data comes from the (sections) layout's prefetch, through `useBotData`. */
export default function BotModerationRoute() {
  return <ModerationPage />;
}
