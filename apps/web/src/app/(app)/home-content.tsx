"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  ListTodo,
  Monitor,
  Palette,
  Shield,
  Timer,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { DevLoginButton } from "@/components/dev-login-button";
import { TwitchIcon } from "@/components/icons/twitch-icon";
import { StatusChip } from "@/components/status-chip";
import Loader from "@/components/loader";

const features = [
  { icon: Timer, label: "Pomodoro timer" },
  { icon: ListTodo, label: "Chat task list" },
  { icon: Bot, label: "Twitch bot" },
  { icon: Palette, label: "6 themes" },
  { icon: Monitor, label: "OBS overlays" },
  { icon: Shield, label: "Self-hosted" },
] as const;

/** Decorative hardware-timer module — the product's signature motif. */
function TimerModuleMock() {
  return (
    <div
      aria-hidden
      className="bg-grain relative flex w-64 flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card px-8 py-7 shadow-lg shadow-black/10 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-16px_rgba(0,0,0,0.5)]"
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

const SIGN_IN_ERRORS: Record<string, { title: string; hint: string }> = {
  instance_claimed: {
    title: "This Dirework already belongs to a different Twitch account.",
    hint: "Each Dirework belongs to one streamer. Sign in with the account that claimed it, or deploy your own copy.",
  },
  signin_failed: {
    title: "Twitch sign-in didn't complete.",
    hint: "Nothing was changed — try the button again. If it keeps failing, check that the Twitch app's redirect URL matches this site.",
  },
};

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signInError, setSignInError] = useState<(typeof SIGN_IN_ERRORS)[string] | null>(null);

  // Persist the error inline (a missed toast is a dead end), then strip the
  // query param so refresh/share doesn't re-trigger it.
  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    setSignInError(SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.signin_failed);
    router.replace("/", { scroll: false });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <section className="flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:justify-between lg:gap-6">
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

          {signInError && (
            <div
              role="alert"
              className="flex w-full max-w-lg items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="text-sm">
                <p className="font-medium">{signInError.title}</p>
                <p className="mt-0.5 text-muted-foreground">{signInError.hint}</p>
              </div>
            </div>
          )}
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
              <TwitchIcon className="size-4" />
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
                  aria-label="View on GitHub (opens in a new tab)"
                />
              }
            >
              View on GitHub
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </div>

          <DevLoginButton />

          {/* Compact feature strip — body-size type: this is the product pitch,
              not a micro-label (NN/g: content shouldn't ship in 11px caps). */}
          <ul className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {features.map((feature) => (
              <li
                key={feature.label}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-sm text-foreground/85"
              >
                <feature.icon className="size-4 text-primary" aria-hidden />
                {feature.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Signature hardware-timer module */}
        <div className="relative shrink-0">
          <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <TimerModuleMock />
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
