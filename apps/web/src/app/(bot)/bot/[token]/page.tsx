import type { Metadata } from "next";

import { parseBotView } from "@/lib/bot-view";

import { BotConsole } from "./bot-console";

export const metadata: Metadata = {
  // Absolute: skip the "%s | DireWork" root template — this page lives in an
  // OBS browser source, an OBS custom browser dock or a pinned tab, not the app shell.
  title: { absolute: "DireWork Bot Console" },
  robots: { index: false, follow: false, noarchive: true },
};

/** `?view=dock` renders the compact OBS dock layout; same bot session, same requests. */
export default async function BotPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <BotConsole view={parseBotView(view)} />;
}
