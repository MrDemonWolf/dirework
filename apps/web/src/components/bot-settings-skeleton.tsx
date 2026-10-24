// Loading placeholder for a Bot settings sub-page. The heading and sub-nav come from the
// route's layout and are never skeletons; this fills the page body. Shown by
// `dashboard/bot/loading.tsx` the moment a navigation into Bot settings starts, by
// `(sections)/loading.tsx` while a sub-page switch renders, and by the data gate
// (`(sections)/bot-data.tsx`) until `config.get` and `user.me` resolve. Its blocks follow the
// Overview layout (two panels side by side, a third under them).

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

function PanelSkeleton() {
  return (
    <Card className="panel">
      <CardHeader className="border-b border-border/40 px-5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <BotConsoleBodySkeleton />
      </CardContent>
    </Card>
  );
}

/** Static, data-free skeleton of a Bot settings page body. */
export function BotSettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </div>
  );
}
