"use client";

import { Check } from "lucide-react";

import type { ThemePreset } from "@/lib/config-types";
import { cn } from "@/lib/utils";

/**
 * Preset swatch. Rendered as a radio inside the ThemeBrowser radiogroup
 * (audit L13 — proper role/aria-checked semantics + visible focus ring).
 * The face is a mini overlay mock so the card communicates the actual look.
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
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      tabIndex={tabIndex}
      onClick={onApply}
      onFocus={onFocus}
      className={cn(
        "group relative flex w-36 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        isActive
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
      )}
    >
      {/* Mini overlay mock — timer digits + accent rail on the preset's bg */}
      <div
        className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-t-lg"
        style={{ background: theme.preview.bg }}
      >
        <span
          className="font-heading text-xl font-semibold tracking-tight tabular-nums"
          style={{ color: theme.preview.text }}
        >
          25:00
        </span>
        <span
          aria-hidden
          className="h-1 w-10 rounded-full"
          style={{ background: theme.preview.accent }}
        />
        {isActive && (
          <div className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary">
            <Check className="size-3 text-primary-foreground" />
          </div>
        )}
      </div>
      {/* Name + description */}
      <div className="px-2 py-2">
        <p className="text-xs font-medium">{theme.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {theme.description}
        </p>
      </div>
    </button>
  );
}
