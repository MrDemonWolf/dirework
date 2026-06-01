"use client";

import { Timer, ListTodo, Bot, Palette } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const perks = [
  { icon: Timer, label: "A Pomodoro timer your viewers can see in OBS" },
  { icon: ListTodo, label: "A shared task list your chat fills in" },
  { icon: Bot, label: "A Twitch bot that runs the commands for you" },
  { icon: Palette, label: "11 themes — or style every pixel yourself" },
];

export default function SetupContent() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Focus ring badge */}
        <div className="mb-8 flex justify-center">
          <div className="relative size-20">
            <svg viewBox="0 0 80 80" className="size-full">
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
          <span className="inline-block rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
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
        <div className="mt-8 rounded-2xl border bg-card/50 p-5">
          <p className="mb-4 text-sm font-medium">Here&apos;s what you&apos;re turning on:</p>
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
          <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
          </svg>
          Claim with Twitch
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          One streamer, one instance. Once you claim it, this page turns off for good.
        </p>
      </div>
    </div>
  );
}
