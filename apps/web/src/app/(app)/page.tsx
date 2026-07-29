import { redirect } from "next/navigation";

import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import HomeContent from "./home-content";

export default async function Home() {
  const [owned, session] = await Promise.all([getInstanceOwned(), getServerSession()]);

  if (session?.user) {
    redirect("/dashboard");
  }

  if (!owned) {
    redirect("/setup");
  }

  return <HomeContent />;
}
