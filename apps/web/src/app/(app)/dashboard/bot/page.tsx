import { auth } from "@dirework/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BotSettingsPage from "./bot-settings-page";

export default async function BotRoute() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return <BotSettingsPage />;
}
