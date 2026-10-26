import type { Metadata } from "next";

import { parseBotView } from "@/lib/bot-view";

import { BotConsole } from "./bot-console";

export const metadata: Metadata = {
  // Absolute: skip the "%s | DireWork" root template — this page lives in an OBS browser
  // source, a Moblin widget, an OBS custom browser dock or a pinned tab, not the app shell.
  // The console replaces it with the live state ("DireWork bot · Connected") once it runs.
  title: { absolute: "DireWork bot" },
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * The default view is the blank widget; `?view=dock` the visible control panel. Same bot
 * session, same requests.
 */
export default async function BotPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <BotConsole view={parseBotView(view)} />;
}
