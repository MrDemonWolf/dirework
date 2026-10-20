import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * `destructive` is an alert (something went wrong or will); `info` is a status note
 * (a group is switched off, a step is optional) and is announced politely.
 */
const variants = {
  destructive: {
    box: "border-destructive/30 bg-destructive/10",
    icon: AlertTriangle,
    iconClass: "text-destructive",
    role: "alert",
  },
  info: {
    box: "border-border/60 bg-muted/40",
    icon: Info,
    iconClass: "text-primary",
    role: "status",
  },
} as const;

export function Callout({
  title,
  variant = "destructive",
  children,
  className,
}: {
  title: ReactNode;
  variant?: keyof typeof variants;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, iconClass, role } = variants[variant];
  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", box, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        {children && <p className="mt-0.5 text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}
