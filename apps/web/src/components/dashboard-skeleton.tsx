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
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid gap-6">
        {/* Timer console skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
              <div className="flex flex-1 flex-col items-center gap-4 py-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-20 w-56" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-9 w-32" />
              </div>
              <div className="w-full max-w-56 space-y-3 lg:w-56">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
              <Skeleton className="h-[280px] w-[280px] shrink-0 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Tasks card skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </div>
              <Skeleton className="h-[350px] w-[350px] shrink-0 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Overlay URLs + bot status skeleton */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
