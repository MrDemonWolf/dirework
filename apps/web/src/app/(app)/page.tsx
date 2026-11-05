import { redirect } from "next/navigation";

import { landingLinks } from "@/lib/landing-links";
import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import { resolveSignInError } from "@/lib/sign-in-errors";
import { ViewerLanding } from "./viewer-landing";

/**
 * No loading.tsx wraps this page or /setup (shell-hold.test.ts pins it), so nothing streams
 * until these checks answer: the owner and an unclaimed instance get a real 307, and a visitor
 * gets the finished landing in one paint. A client navigation here keeps the previous page
 * until this one is ready.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [owned, session, params] = await Promise.all([
    getInstanceOwned(),
    getServerSession(),
    searchParams,
  ]);

  if (session?.user?.isOwner) {
    redirect("/dashboard");
  }

  if (!owned) {
    redirect("/setup");
  }

  // `?error=` comes from better-auth's errorCallbackURL or the bot OAuth redirects. Only the
  // code is read, and it only selects fixed copy; the raw value is never rendered.
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <ViewerLanding
      // Plain worker var surfaced through process.env by OpenNext (alchemy.run.ts).
      links={landingLinks(process.env.DOCS_URL)}
      signInError={errorCode ? resolveSignInError(errorCode) : null}
    />
  );
}
