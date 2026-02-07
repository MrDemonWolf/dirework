"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";

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
    <div className="flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-5xl font-bold tracking-tight">Dirework</h1>
        <p className="text-lg text-muted-foreground">
          Focus timer for your Twitch stream
        </p>
      </div>

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
