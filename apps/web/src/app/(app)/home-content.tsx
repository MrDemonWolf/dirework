"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  ListTodo,
  Monitor,
  Palette,
  Shield,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/status-chip";
import Loader from "@/components/loader";

const features = [
  {
    icon: Timer,
    title: "Pomodoro Timer",
    description: "Configurable work/break cycles with OBS overlay",
  },
  {
    icon: ListTodo,
    title: "Chat Task List",
    description: "Viewers add tasks via !task command",
  },
  {
    icon: Bot,
    title: "Twitch Bot",
    description: "Connect a bot account for chat commands",
  },
  {
    icon: Palette,
    title: "11 Theme Presets",
    description: "From Neon Cyberpunk to Cozy Cottage",
  },
  {
    icon: Monitor,
    title: "OBS Browser Sources",
    description: "Transparent overlays, just paste the URL",
  },
  {
    icon: Shield,
    title: "Self-Hosted",
    description: "Your data, your server",
  },
] as const;

/** Decorative hardware-timer module — the product's signature motif. */
function TimerModuleMock() {
  return (
    <div
      aria-hidden
      className="bg-grain relative flex w-64 flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card px-8 py-7 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-16px_rgba(0,0,0,0.5)]"
    >
      <StatusChip tone="accent" label="Focus" pulse />
      <p className="font-heading text-6xl font-bold tabular-nums tracking-tight">18:32</p>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-primary" />
        <span className="size-2 rounded-full bg-primary ring-2 ring-primary/30" />
        <span className="size-2 rounded-full border border-muted-foreground/40" />
        <span className="size-2 rounded-full border border-muted-foreground/40" />
      </div>
      <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Pomo 2 of 4
      </p>
    </div>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "instance_claimed") {
      toast.error("This instance is already claimed by another account.");
    } else if (error === "signin_failed") {
      toast.error("Sign in failed. Please try again.");
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-16 md:py-24 lg:flex-row lg:justify-between lg:gap-6">
        <div className="flex max-w-xl flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <span className="console-label rounded-full border bg-muted/50 px-3.5 py-1.5">
            Self-hosted · Built for Twitch
          </span>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Focus together,{" "}
            <span className="text-primary">stream better.</span>
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            A co-working timer and task list for your Twitch stream. Viewers join the focus
            session, add tasks via chat, and stay productive together.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Button
              size="lg"
              className="cursor-pointer gap-2 bg-twitch text-white hover:bg-twitch-hover"
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
              Sign in with Twitch
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={
                <a
                  href="https://github.com/mrdemonwolf/dirework"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              View on GitHub
            </Button>
          </div>
        </div>

        {/* Signature hardware-timer module */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <TimerModuleMock />
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full max-w-5xl px-4 pb-20">
        <p className="console-label mb-4">What&apos;s in the box</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50">
              <CardContent className="flex items-start gap-4 pt-2">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function HomeContent() {
  return (
    <Suspense fallback={<Loader />}>
      <HomeInner />
    </Suspense>
  );
}
