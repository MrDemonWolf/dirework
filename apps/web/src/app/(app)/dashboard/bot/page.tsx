import type { Metadata } from "next";

import { Suspense } from "react";

import { requireSession } from "@/lib/auth-guard";
import BotSettingsPage from "./bot-settings-page";

export const metadata: Metadata = { title: "Bot settings" };

export default async function BotRoute() {
  await requireSession();

  return (
    <Suspense>
      <BotSettingsPage />
    </Suspense>
  );
}
