"use client";

import { Timer, ListTodo, Bot, Palette } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { DevLoginButton } from "@/components/dev-login-button";
import { TwitchIcon } from "@/components/icons/twitch-icon";

const perks = [
  { icon: Timer, label: "A Pomodoro timer your viewers can see in OBS" },
  { icon: ListTodo, label: "A shared task list your chat fills in" },
  { icon: Bot, label: "A Twitch bot that runs the commands for you" },
  { icon: Palette, label: "6 themes — or style every pixel yourself" },
];

export default function SetupContent() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Focus ring badge — the brand motif */}
        <div className="mb-6 flex justify-center">
          <div className="relative size-20">
            <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl" aria-hidden />
            <svg viewBox="0 0 80 80" className="relative size-full">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                className="stroke-border"
                strokeWidth="5"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                className="stroke-primary"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="90 214"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Timer className="size-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Heading — warm, plain language */}
        <div className="space-y-3 text-center">
          <span className="console-label inline-block rounded-full border bg-muted/50 px-3 py-1">
            Welcome — let&apos;s get you set up
          </span>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            This instance is all yours
          </h1>
          <p className="text-muted-foreground">
            Sign in with Twitch to claim it. That&apos;s the whole setup — one click and
            you&apos;re the owner. No forms, no passwords to remember.
          </p>
        </div>

        {/* What you get */}
        <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <p className="console-label mb-4">Here&apos;s what you&apos;re turning on</p>
          <ul className="space-y-3">
            {perks.map((perk) => (
              <li key={perk.label} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <perk.icon className="size-4 text-primary" />
                </span>
                <span className="pt-1">{perk.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="mt-6 w-full cursor-pointer gap-2 bg-twitch text-white hover:bg-twitch-hover"
          onClick={() =>
            authClient.signIn.social({
              provider: "twitch",
              callbackURL: "/dashboard",
              errorCallbackURL: "/?error=signin_failed",
            })
          }
        >
          <TwitchIcon className="size-4" />
          Claim with Twitch
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          One streamer, one instance. Once you claim it, this page turns off for good.
        </p>

        <div className="mt-4 flex justify-center">
          <DevLoginButton />
        </div>
      </div>
    </div>
  );
}
