import type { Metadata } from "next";

import RepliesPage from "./replies-page";

export const metadata: Metadata = { title: "Bot replies" };

/** Data streams from the (sections) layout; each card is a `BotSection` (../bot-data.tsx). */
export default function BotRepliesRoute() {
  return <RepliesPage />;
}
