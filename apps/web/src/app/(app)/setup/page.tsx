// Server gate for /setup: the claim page exists only while the instance is unclaimed.

import type { Metadata } from "next";

import { notFound, redirect } from "next/navigation";

import { landingLinks } from "@/lib/landing-links";
import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import { resolveSignInError } from "@/lib/sign-in-errors";
import SetupContent from "./setup-content";

export const metadata: Metadata = {
  title: "Setup",
  description: "Claim this DireWork instance as the streamer.",
};

/**
 * Owner session -> /dashboard; already claimed -> 404; otherwise render the claim screen.
 * `getInstanceOwned` fails closed (reports "owned" when the api can't be reached), so an api
 * outage 404s this page rather than offering a claim the server would refuse anyway.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [owned, session, params] = await Promise.all([
    getInstanceOwned(),
    getServerSession(),
    searchParams,
  ]);

  // An authenticated owner goes straight to the dashboard.
  if (session?.user?.isOwner) {
    redirect("/dashboard");
  }

  // Instance already claimed, no owner session — this route no longer exists.
  if (owned) {
    notFound();
  }

  // `?error=` comes from better-auth's errorCallbackURL (a failed or cancelled claim). Only
  // the code is read, and it only selects fixed copy; the raw value is never rendered.
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <SetupContent
      // Plain worker var surfaced through process.env by OpenNext (alchemy.run.ts).
      links={landingLinks(process.env.DOCS_URL)}
      signInError={errorCode ? resolveSignInError(errorCode) : null}
    />
  );
}
