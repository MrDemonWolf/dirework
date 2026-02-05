"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bot, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}

function DashboardContent() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">General</h1>
        <p className="text-muted-foreground">
          Manage your bot connection and account settings.
        </p>
      </div>

      {/* Bot Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Bot Account
          </CardTitle>
          <CardDescription>
            Connect a Twitch account to use as your chat bot. This account will
            send messages in your channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No bot account connected yet.
          </p>
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="h-3 w-3" />
              Timer: Offline
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="h-3 w-3" />
              Tasks: Offline
            </Badge>
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled>
            Connect Bot Account
          </Button>
        </CardFooter>
      </Card>

      {/* Placeholder cards for other sections */}
      <Card>
        <CardHeader>
          <CardTitle>Overlay URLs</CardTitle>
          <CardDescription>
            Your overlay URLs will appear here once connected. Add them as
            Browser Sources in OBS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your bot account first to generate overlay URLs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Authenticated>
        <DashboardContent />
      </Authenticated>
      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AuthLoading>
    </>
  );
}
