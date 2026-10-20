// Loading placeholder for Bot settings. Shown by the route's loading.tsx the moment a
// navigation starts, and by the page itself until `config.get` and `user.me` resolve. Its
// blocks mirror the live layout (console + account rail, commands card) so nothing jumps when
// data lands; update it alongside bot-settings-page.tsx.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Static, data-free skeleton of the Bot settings page. */
export function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-6 lg:w-80 lg:shrink-0">
          <Card className="panel-hero">
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
          <Card className="panel">
            <CardHeader>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 flex-1">
          <Card className="panel">
            <CardHeader>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-52" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-4 h-9 w-72" />
              <div className="space-y-3">
                {["bot-field-1", "bot-field-2", "bot-field-3", "bot-field-4"].map((key) => (
                  <Skeleton key={key} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
