import type { Metadata } from "next";

import BotOverviewPage from "./overview-page";

export const metadata: Metadata = { title: "Bot settings" };

/** Data comes from the (sections) layout's prefetch, through `useBotData`. */
export default function BotOverviewRoute() {
  return <BotOverviewPage />;
}
