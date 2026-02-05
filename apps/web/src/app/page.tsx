"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Timer, CheckSquare, MessageCircle } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const features = [
  {
    icon: Timer,
    title: "Pomodoro Timer",
    description: "Stay focused with timed work sessions and breaks, right on your stream.",
  },
  {
    icon: CheckSquare,
    title: "Task List",
    description: "Let viewers track their goals on stream with chat commands.",
  },
  {
    icon: MessageCircle,
    title: "Chat Bot",
    description: "Your viewers control it all via Twitch chat commands.",
  },
];

function LoginContent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md space-y-8 text-center">
        {/* Logo & Title */}
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Timer className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Dirework</h1>
          <p className="text-muted-foreground text-lg">
            Focus timer & task tracker for your stream
          </p>
        </div>

        {/* Sign In Button */}
        <Button
          size="lg"
          className="w-full cursor-pointer gap-3 bg-[#9146FF] text-white hover:bg-[#7c3aed] text-base py-6"
          onClick={() => {
            authClient.signIn.social({ provider: "twitch", callbackURL: "/dashboard" });
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          Sign in with Twitch
        </Button>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50 bg-card/50">
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <feature.icon className="h-6 w-6 text-muted-foreground" />
                <h3 className="text-sm font-medium">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function RedirectToDashboard() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}

function LoadingState() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md space-y-8 text-center">
        <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
        <Skeleton className="mx-auto h-10 w-48" />
        <Skeleton className="mx-auto h-6 w-64" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <LoginContent />
      </Unauthenticated>
      <AuthLoading>
        <LoadingState />
      </AuthLoading>
    </>
  );
}
