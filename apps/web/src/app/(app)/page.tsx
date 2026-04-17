import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth, hasOwner } from "@dirework/auth";
import HomeContent from "./home-content";

export default async function Home() {
  const [owned, session] = await Promise.all([
    hasOwner(),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (session?.user) {
    redirect("/dashboard");
  }

  if (!owned) {
    redirect("/setup");
  }

  return <HomeContent />;
}
