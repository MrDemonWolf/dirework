import type { Metadata } from "next";

import BotOverviewPage from "./overview-page";

export const metadata: Metadata = { title: "Bot settings" };

/** Data streams from the (sections) layout; each card is a `BotSection` (./bot-data.tsx). */
export default function BotOverviewRoute() {
  return <BotOverviewPage />;
}
