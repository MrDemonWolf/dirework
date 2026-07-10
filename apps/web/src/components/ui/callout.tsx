import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

// ponytail: destructive-only for now (the one variant in use). Add a `variant`
// prop if an info/warning callout is ever needed.
export function Callout({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        {children && <p className="mt-0.5 text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}
