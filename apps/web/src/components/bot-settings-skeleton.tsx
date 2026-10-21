// Loading placeholder for Bot settings. Shown by the route's loading.tsx the moment a
// navigation starts, and by the page itself until `config.get` and `user.me` resolve. Its
// blocks mirror the live layout (console and account cards side by side, then the full-width
// commands card) so nothing jumps when data lands; update it alongside bot-settings-page.tsx.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The console card's body while its URL query is pending — also used inside the live card
 * (bot-console-card.tsx), so the page skeleton and the in-card placeholder can't drift.
 */
export function BotConsoleBodySkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-10 w-full" />
    </>
  );
}

/** Static, data-free skeleton of the Bot settings page. */
export function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card className="panel-hero">
            <CardHeader className="border-b border-border/40 px-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4 px-5">
              <BotConsoleBodySkeleton />
            </CardContent>
          </Card>
          <Card className="panel">
            <CardHeader className="border-b border-border/40 px-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-4 px-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card className="panel">
          <CardHeader className="border-b border-border/40 px-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-5 px-5">
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <Skeleton className="h-64 w-full" />
              <div className="space-y-3">
                {["bot-field-1", "bot-field-2", "bot-field-3", "bot-field-4"].map((key) => (
                  <Skeleton key={key} className="h-20 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
