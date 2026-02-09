import { auth } from "@dirework/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import StylesPage from "./styles-page";

export default async function StylesRoute() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return <StylesPage />;
}
