// The card frame every Bot settings card shares, live (components/bot-settings/, the
// (sections) pages) and placeholder (components/bot-settings-skeleton.tsx): one place for the
// padding, the header rule and the title type, so a placeholder keeps repeating its live card
// box for box. No hooks, so server and client components both render it.

import type { ReactNode } from "react";

import { PANEL_TITLE_CLASS } from "@/lib/panel-header";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** The frame's classes, for a heading-free skeleton (`PanelSkeleton`) that can't take a title. */
export const SETTINGS_CARD_CLASS = "panel";
export const SETTINGS_CARD_HEADER_CLASS = "border-b border-border/40 px-5";
export const SETTINGS_CARD_CONTENT_CLASS = "px-5";

export function SettingsCard({
  title,
  description,
  action,
  contentClassName,
  children,
}: {
  /** The card's `h2`. */
  title: string;
  description: ReactNode;
  /** Top right of the header: a status chip or the group switch. */
  action?: ReactNode;
  /** Spacing of the body, e.g. `space-y-4`. */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <CardHeader className={SETTINGS_CARD_HEADER_CLASS}>
        <CardTitle as="h2" className={PANEL_TITLE_CLASS}>
          {title}
        </CardTitle>
        {action && <CardAction className="flex items-center">{action}</CardAction>}
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn(SETTINGS_CARD_CONTENT_CLASS, contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
