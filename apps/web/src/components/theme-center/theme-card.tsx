"use client";

import { Check } from "lucide-react";

import type { ThemePreset } from "@/lib/config-types";
import { cn } from "@/lib/utils";

/** ~75%-full ring: r=19 → circumference 2π·19 ≈ 119.4 */
const RING_R = 19;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Preset swatch. Rendered as a radio inside the ThemeBrowser radiogroup
 * (audit L13 — proper role/aria-checked semantics + visible focus ring).
 * The face is a mini overlay mock — timer ring + task rows — so the card
 * shows what BOTH overlays actually look like in the preset.
 */
export function ThemeCard({
  theme,
  isActive,
  onApply,
  onFocus,
  tabIndex = 0,
}: {
  theme: ThemePreset;
  isActive: boolean;
  onApply: () => void;
  onFocus?: () => void;
  tabIndex?: number;
}) {
  const { bg, accent, text } = theme.preview;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      tabIndex={tabIndex}
      onClick={onApply}
      onFocus={onFocus}
      title={`${theme.name} — ${theme.description}`}
      className={cn(
        "group relative flex w-44 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-xl border text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        isActive
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
      )}
    >
      {/* Mini overlay mock — timer ring beside two task rows */}
      <div
        aria-hidden
        className="flex h-24 w-full items-center gap-3 px-3.5"
        style={{ background: bg }}
      >
        {/* Timer: progress ring + digits */}
        <div className="relative grid size-14 shrink-0 place-items-center">
          <svg width="56" height="56" viewBox="0 0 44 44" className="absolute inset-0">
            <circle
              cx="22"
              cy="22"
              r={RING_R}
              fill="none"
              stroke={text}
              strokeOpacity="0.18"
              strokeWidth="3"
            />
            <circle
              cx="22"
              cy="22"
              r={RING_R}
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * 0.25}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span
            className="font-heading text-[11px] font-semibold tracking-tight tabular-nums"
            style={{ color: text }}
          >
            25:00
          </span>
        </div>
        {/* Task list: open row + done row */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded-[4px] border-[1.5px]"
              style={{ borderColor: accent }}
            />
            <span
              className="h-1.5 flex-1 rounded-full"
              style={{ background: text, opacity: 0.75 }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="grid size-3 shrink-0 place-items-center rounded-[4px]"
              style={{ background: accent }}
            >
              <Check className="size-2" style={{ color: bg }} strokeWidth={4} />
            </span>
            <span
              className="h-1.5 w-3/5 rounded-full"
              style={{ background: text, opacity: 0.35 }}
            />
          </div>
        </div>
        {isActive && (
          <div className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary shadow-sm">
            <Check className="size-3 text-primary-foreground" />
          </div>
        )}
      </div>
      {/* Name + description — two lines, no mid-word mystery ellipsis */}
      <div className="border-t border-border/60 px-3 py-2">
        <p className="text-xs font-medium">{theme.name}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {theme.description}
        </p>
      </div>
    </button>
  );
}
