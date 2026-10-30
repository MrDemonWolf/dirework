import type { Metadata } from "next";

import ModerationPage from "./moderation-page";

export const metadata: Metadata = { title: "Bot moderation" };

/** Data streams from the (sections) layout; each card is a `BotSection` (../bot-data.tsx). */
export default function BotModerationRoute() {
  return <ModerationPage />;
}
