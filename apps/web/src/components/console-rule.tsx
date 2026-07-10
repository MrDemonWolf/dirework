import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "Focus Console" section header: a hairline rule with a mono label. Was
 * copy-pasted ~15× and shipped inconsistently as <span> in most places and <h2>
 * in a couple — pass `as="h2"` where the label is a real heading. Extra
 * children (e.g. a size chip) render after the label inside the rule.
 */
export function ConsoleRule({
  label,
  as: Tag = "span",
  id,
  className,
  children,
}: {
  label: ReactNode;
  as?: "span" | "h2";
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("console-rule", className)}>
      <Tag id={id} className="console-label">
        {label}
      </Tag>
      {children}
    </div>
  );
}
