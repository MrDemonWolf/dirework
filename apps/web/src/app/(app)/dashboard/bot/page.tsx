import { Suspense } from "react";

import { requireSession } from "@/lib/auth-guard";
import BotSettingsPage from "./bot-settings-page";

export default async function BotRoute() {
  await requireSession();

  return (
    <Suspense>
      <BotSettingsPage />
    </Suspense>
  );
}
