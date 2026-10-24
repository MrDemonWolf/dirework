import type { Metadata } from "next";

import RepliesPage from "./replies-page";

export const metadata: Metadata = { title: "Bot replies" };

/** Data comes from the (sections) layout's prefetch, through `useBotData`. */
export default function BotRepliesRoute() {
  return <RepliesPage />;
}
