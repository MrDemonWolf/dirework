"use client";

import { Check } from "lucide-react";

import type { ThemePreset } from "@/lib/config-types";
import { cn } from "@/lib/utils";

/**
 * Preset swatch. Rendered as a radio inside the ThemeBrowser radiogroup
 * (audit L13 — proper role/aria-checked semantics + visible focus ring).
 */
export function ThemeCard({
  theme,
  isActive,
  onApply,
  tabIndex = 0,
}: {
  theme: ThemePreset;
  isActive: boolean;
  onApply: () => void;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      tabIndex={tabIndex}
      onClick={onApply}
      className={cn(
        "group relative flex w-36 shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-all hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        isActive
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
      )}
    >
      {/* Gradient preview */}
      <div
        className="relative h-20 w-full"
        style={{
          background: `linear-gradient(135deg, ${theme.preview.bg} 0%, ${theme.preview.accent} 100%)`,
        }}
      >
        {/* Small circle showing text color */}
        <div
          className="absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-full text-xs font-bold"
          style={{
            backgroundColor: theme.preview.bg,
            color: theme.preview.text,
          }}
        >
          A
        </div>
        {isActive && (
          <div className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary">
            <Check className="size-3 text-primary-foreground" />
          </div>
        )}
      </div>
      {/* Name + description */}
      <div className="px-2 py-2">
        <p className="text-xs font-medium">{theme.name}</p>
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {theme.description}
        </p>
      </div>
    </button>
  );
}
