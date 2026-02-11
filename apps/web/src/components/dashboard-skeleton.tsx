import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Greeting skeleton */}
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>

      <div className="grid gap-6">
        {/* Timer hero card skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-16 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Two-column grid skeleton */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Tasks card skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overlay URLs card skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
