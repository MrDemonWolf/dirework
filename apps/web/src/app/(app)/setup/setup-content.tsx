// First-run claim screen: shown only while the instance has no owner (see setup/page.tsx).
// The first Twitch sign-in claims the instance; later sign-ins by anyone else are refused.
// Server-rendered and static: no queries, no polling. The only client code is the Twitch
// button, the sign-in notice's URL cleanup and the dev-only bypass button.

import { BRAND } from "@dirework/overlay-kit";

import type { LandingLinks } from "@/lib/landing-links";
import type { SignInError } from "@/lib/sign-in-errors";
import { DevLoginButton } from "@/components/dev-login-button";
import { StreamScene } from "@/components/stream-scene";
import { SignInNotice } from "../sign-in-notice";
import { ClaimButton } from "./claim-button";

/** The deployment guide's section on resetting the database after someone else claimed it. */
export const RECOVERY_ANCHOR = "#recovering-an-instance-someone-else-claimed";

/**
 * What the owner does next, named as the dashboard's setup checklist names its steps (the
 * three OBS browser sources folded into one), so the owner meets the same words after the
 * claim.
 */
export const AFTER_CLAIM_STEPS = [
  {
    title: "Connect the bot account",
    body: "The bot is the Twitch account that reads chat commands and replies in your channel.",
  },
  {
    title: "Add the overlays to OBS",
    body: "Copy the bot page, timer overlay and tasks overlay URLs into OBS browser sources.",
  },
  {
    title: "Viewers join from chat",
    body: (
      <>
        Viewers add their own tasks with <code className="font-mono text-foreground">!task</code>,
        and the list on stream shows them.
      </>
    ),
  },
] as const;

const inlineLink =
  "font-medium text-foreground underline underline-offset-4 hover:text-link focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default function SetupContent({
  links,
  signInError,
}: {
  links: LandingLinks;
  signInError: SignInError | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:gap-16">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="setup-title" className="flex min-w-0 flex-col items-start gap-5">
          <div className="space-y-2">
            {/* One text node each: the e2e suite finds the page by this exact string in the HTML,
                and an interpolated `{BRAND.name}` would stream with `<!-- -->` separators. */}
            <h1
              id="setup-title"
              className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl"
            >
              {`Claim your ${BRAND.name} instance`}
            </h1>
            <h2 className="font-heading text-xl font-semibold text-muted-foreground">
              {`This ${BRAND.name} is all yours`}
            </h2>
          </div>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            The first Twitch account to sign in here becomes the owner, and nobody else can sign in
            after that. If someone else gets there first, reset the database as the{" "}
            <a href={`${links.deployGuide}${RECOVERY_ANCHOR}`} className={inlineLink}>
              deployment guide
            </a>{" "}
            explains.
          </p>

          {signInError && <SignInNotice error={signInError} deployUrl={links.deployGuide} />}

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start">
            <ClaimButton />
            <DevLoginButton />
          </div>
        </section>

        <StreamScene compact className="min-w-0" />
      </div>

      <section aria-labelledby="after-claim-title" className="space-y-5">
        <h2 id="after-claim-title" className="font-heading text-2xl font-bold tracking-tight">
          After you claim
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {AFTER_CLAIM_STEPS.map((step, index) => (
            <li key={step.title} className="panel-inset flex gap-3 p-4">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/40 font-heading text-sm font-bold text-link tabular-nums"
              >
                {index + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
