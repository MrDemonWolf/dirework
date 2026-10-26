// The task overlay's bullet and checkbox-tick icons: the fixed set in OVERLAY_ICONS
// (@dirework/api/style-limits) drawn with lucide-react (ISC). Named imports only, so the
// overlay bundle carries these twelve icons (plus the hand-drawn dot) and nothing else of
// the library.

import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
  Flame,
  Heart,
  type LucideIcon,
  PawPrint,
  Sparkles,
  SquareCheck,
  Star,
  Zap,
} from "lucide-react";

import type { OverlayIcon as OverlayIconId } from "@dirework/api/style-limits";

const ICONS: Record<Exclude<OverlayIconId, "none" | "dot">, LucideIcon> = {
  circle: Circle,
  check: Check,
  "check-circle": CircleCheck,
  "square-check": SquareCheck,
  star: Star,
  sparkles: Sparkles,
  "arrow-right": ArrowRight,
  "chevron-right": ChevronRight,
  "paw-print": PawPrint,
  heart: Heart,
  flame: Flame,
  zap: Zap,
};

/**
 * One overlay icon, `size` square (any CSS length the style allows) in `currentColor`, so
 * the row's color field paints it. Decorative: the row's text says what it is. "none"
 * renders nothing.
 */
export function OverlayIcon({
  icon,
  size,
  className,
  style,
}: {
  icon: OverlayIconId;
  size: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (icon === "none") return null;
  const boxStyle = { width: size, height: size, flexShrink: 0, ...style };
  if (icon === "dot") {
    // Lucide's Dot is a stroked 2px ring; a bullet wants a solid disc, so draw one.
    return (
      <svg aria-hidden focusable={false} viewBox="0 0 24 24" className={className} style={boxStyle}>
        <circle cx="12" cy="12" r="5" fill="currentColor" />
      </svg>
    );
  }
  const Icon = ICONS[icon];
  return (
    <Icon aria-hidden focusable={false} strokeWidth={2.25} className={className} style={boxStyle} />
  );
}
