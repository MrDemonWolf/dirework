"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
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

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "unauthorized") {
      toast.error("You are not authorized to access this instance.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (session?.user) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center md:py-32">
        <div className="rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          Self-hosted Pomodoro for Twitch
        </div>
        <h1 className="max-w-2xl font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Focus together,{" "}
          <span className="bg-gradient-to-r from-primary to-[oklch(0.6_0.2_290)] bg-clip-text text-transparent">
            stream better.
          </span>
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          A co-working timer and task list for your Twitch stream. Viewers join the focus
          session, add tasks via chat, and stay productive together.
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="cursor-pointer bg-[#9146FF] text-white hover:bg-[#7c3ae6]"
            onClick={() =>
              authClient.signIn.social({
                provider: "twitch",
                callbackURL: "/dashboard",
              })
            }
          >
            Sign in with Twitch
          </Button>
          <Button
            variant="outline"
            size="lg"
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
      </section>

      {/* Features Grid */}
      <section className="w-full max-w-5xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
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

export default function Home() {
  return (
    <Suspense fallback={<Loader />}>
      <HomeContent />
    </Suspense>
  );
}
