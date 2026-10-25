import type { Metadata } from "next";

import CommandsPage from "./commands-page";

export const metadata: Metadata = { title: "Bot commands" };

/** Data streams from the (sections) layout; each card is a `BotSection` (../bot-data.tsx). */
export default function BotCommandsRoute() {
  return <CommandsPage />;
}
