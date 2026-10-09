"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

/**
 * (app) error boundary. Most often reached when the api worker can't answer the
 * session check (rate limit, outage, timeout): that is NOT "signed out", so the
 * owner gets a retry here instead of being bounced to the sign-in page.
 * Production strips server error messages, so the copy is fixed.
 *
 * Retry refreshes the server components AND resets the boundary: reset() alone
 * re-renders the client tree but would reuse the failed server payload.
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-4 px-4 py-16">
      <Callout title="This page couldn't load">
        This usually means Dirework couldn't reach its API (a brief outage or rate limit). You
        haven't been signed out and your saved settings are untouched. Wait a moment and try again,
        or head back to the dashboard.
      </Callout>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={"/dashboard" as const} />}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
