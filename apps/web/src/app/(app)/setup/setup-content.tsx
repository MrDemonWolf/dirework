"use client";

import { Shield, Timer, ListTodo, Bot } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function SetupContent() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="w-full max-w-md space-y-8">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            First-time setup
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Claim this instance
          </h1>
          <p className="text-muted-foreground">
            Sign in with your Twitch account to become the owner of this DireWork instance.
            Only one account can own an instance — this is your personal streaming setup.
          </p>
        </div>

        {/* Features list */}
        <div className="rounded-lg border bg-muted/30 p-4 text-left">
          <p className="mb-3 text-sm font-medium text-foreground">What you get as the owner:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Timer className="size-4 shrink-0 text-primary" />
              Pomodoro timer with OBS overlay
            </li>
            <li className="flex items-center gap-2">
              <ListTodo className="size-4 shrink-0 text-primary" />
              Chat task list for your viewers
            </li>
            <li className="flex items-center gap-2">
              <Bot className="size-4 shrink-0 text-primary" />
              Twitch bot account integration
            </li>
            <li className="flex items-center gap-2">
              <Shield className="size-4 shrink-0 text-primary" />
              Full control over your instance
            </li>
          </ul>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full cursor-pointer bg-[#9146FF] text-white hover:bg-[#7c3ae6]"
          onClick={() =>
            authClient.signIn.social({
              provider: "twitch",
              callbackURL: "/dashboard",
              errorCallbackURL: "/?error=instance_claimed",
            })
          }
        >
          Claim with Twitch
        </Button>

        <p className="text-xs text-muted-foreground">
          Once claimed, this setup page is permanently disabled.
          To re-claim, delete the owner account from the database.
        </p>
      </div>
    </div>
  );
}
