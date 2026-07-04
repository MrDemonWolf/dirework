import type { Metadata } from "next";

import { BotConsole } from "./bot-console";

export const metadata: Metadata = {
  // Absolute: skip the "%s | DireWork" root template — this page lives in an
  // OBS browser source or a pinned tab, not the app shell.
  title: { absolute: "Dirework Bot Console" },
  robots: { index: false, follow: false },
};

export default function BotPage() {
  return <BotConsole />;
}
