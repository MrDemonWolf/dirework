// The home page of a claimed DireWork, as everyone but its owner sees it (the page sends
// the owner to /dashboard and an unclaimed instance to /setup). Its visitors are viewers
// who followed a link from the stream and streamers curious about the tool, so it explains
// what they are looking at and points them at their own copy; the owner's Twitch sign-in is
// a quiet third action. Server-rendered and static: no queries, no polling. The only client
// code is the Twitch button and the sign-in notice's URL cleanup.

import { BookOpen, Bot, ExternalLink, ListTodo, Rocket, Timer } from "lucide-react";

import { BRAND } from "@dirework/overlay-kit";

import { taskCommands } from "@/lib/command-rows";
import type { LandingLinks } from "@/lib/landing-links";
import type { SignInError } from "@/lib/sign-in-errors";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DevLoginButton } from "@/components/dev-login-button";
import { StatusChip } from "@/components/status-chip";
import { StreamScene } from "@/components/stream-scene";
import { OwnerSignIn } from "./owner-sign-in";
import { SignInNotice } from "./sign-in-notice";

/** The three commands a viewer needs first, worded as the Bot settings reference words them. */
const JOIN_COMMANDS = ["!task", "!today", "!done"].map((name) => {
  const row = taskCommands.find((cmd) => cmd.command === name);
  if (!row) throw new Error(`Missing command reference row for ${name}`);
  return row;
});

const PRODUCT = [
  {
    icon: Timer,
    title: "Pomodoro on stream",
    body: "A focus timer overlay for OBS. Work blocks and breaks run on their own, and the ring shows how much of the block is left.",
  },
  {
    icon: ListTodo,
    title: "A shared task list",
    body: "Viewers add their own tasks from chat. The list on stream groups them by name and shows what each person is working on.",
  },
  {
    icon: Bot,
    title: "A Twitch chat bot",
    body: "Answers commands and keeps the list and the timer in step. It runs in an OBS browser source, so there is nothing extra to host.",
  },
] as const;

const linkClass =
  "inline-flex min-h-8 items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function ViewerLanding({
  links,
  signInError,
}: {
  links: LandingLinks;
  signInError: SignInError | null;
}) {
  const trust = [
    { label: "Source on GitHub", href: links.repo },
    { label: "MIT license", href: links.license },
    { label: "Deploy guide", href: links.deployGuide },
    { label: "Releases", href: links.releases },
    { label: "Support", href: links.support },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:gap-20">
      {/* Hero */}
      <section aria-labelledby="landing-title" className="flex flex-col items-start gap-5">
        <StatusChip tone="accent" label={`This channel runs ${BRAND.name}`} />
        <h1
          id="landing-title"
          className="max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          {BRAND.tagline}.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{BRAND.description}</p>

        {signInError && <SignInNotice error={signInError} deployUrl={links.deployGuide} />}

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a href={links.deployGuide} className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
            <Rocket aria-hidden />
            Deploy your own
          </a>
          <a
            href={links.docs}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
          >
            <BookOpen aria-hidden />
            Read the docs
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm text-muted-foreground">Owner?</span>
          <OwnerSignIn />
          <DevLoginButton />
        </div>
      </section>

      <StreamScene />

      {/* Join from chat */}
      <section
        aria-labelledby="join-title"
        className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:gap-10"
      >
        <div className="space-y-2">
          <h2 id="join-title" className="font-heading text-2xl font-bold tracking-tight">
            Join from chat
          </h2>
          <p className="text-muted-foreground">
            Type these in this channel&apos;s Twitch chat while the stream is live. The streamer can
            rename or turn off commands, so theirs may differ.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {JOIN_COMMANDS.map((cmd) => (
            <div key={cmd.command} className="panel-inset flex flex-col gap-1.5 p-4">
              <dt>
                <code className="font-mono text-lg font-semibold text-primary">{cmd.command}</code>
              </dt>
              <dd className="text-sm">{cmd.description}</dd>
              {cmd.usage !== cmd.command && (
                <dd>
                  <code className="font-mono text-xs text-muted-foreground">{cmd.usage}</code>
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      {/* What it is */}
      <section aria-labelledby="product-title" className="space-y-6">
        <h2 id="product-title" className="font-heading text-2xl font-bold tracking-tight">
          Built for co-working streams
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PRODUCT.map((item) => (
            <li key={item.title} className="panel flex flex-col gap-3 p-5">
              <item.icon className="size-5 text-primary" aria-hidden />
              <h3 className="font-heading text-lg font-bold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust */}
      <section
        aria-labelledby="trust-title"
        className="flex flex-col gap-4 border-t border-border pt-8 md:flex-row md:items-center md:justify-between"
      >
        <p id="trust-title" className="max-w-md text-sm text-muted-foreground">
          {BRAND.name} is free and open source. Each streamer runs their own copy on a free
          Cloudflare account.
        </p>
        <ul aria-label="Project links" className="flex flex-wrap gap-x-5 gap-y-2">
          {trust.map((item) => (
            <li key={item.label}>
              <a href={item.href} className={linkClass}>
                {item.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
