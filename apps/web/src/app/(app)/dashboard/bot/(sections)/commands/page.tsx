import type { Metadata } from "next";

import CommandsPage from "./commands-page";

export const metadata: Metadata = { title: "Bot commands" };

/** Data comes from the (sections) layout's prefetch, through `useBotData`. */
export default function BotCommandsRoute() {
  return <CommandsPage />;
}
