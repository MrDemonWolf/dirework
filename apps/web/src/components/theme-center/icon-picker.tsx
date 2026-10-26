"use client";

// Theme Center picker for the task overlay's bullet and checkbox-tick icon: the fixed set
// in OVERLAY_ICONS, drawn exactly as the overlay draws them.

import { useRef, useState } from "react";

import {
  OVERLAY_ICON_LABELS,
  OVERLAY_ICONS,
  type OverlayIcon as OverlayIconId,
} from "@dirework/api/style-limits";

import { nextGridIndex } from "@/lib/grid-navigation";
import { cn } from "@/lib/utils";
import { OverlayIcon } from "@/components/overlay-icon";

/**
 * A radiogroup of icon swatches with a roving tabindex, like the preset gallery: arrow
 * keys move focus (Left/Right wrap, Up/Down move a row, Home/End jump), Enter, Space or a
 * click picks. The label sits above a full-width grid, so the swatches keep a 44px touch
 * target instead of squeezing into the editor's narrow control column.
 */
export function IconPickerRow({
  label,
  id,
  value,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  value: OverlayIconId;
  onChange: (value: OverlayIconId) => void;
  hint?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const selected = Math.max(0, OVERLAY_ICONS.indexOf(value));
  const [focused, setFocused] = useState<number | null>(null);
  const tabStop = focused ?? selected;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const grid = gridRef.current;
    if (!grid) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
    const next = nextGridIndex(e.key, tabStop, OVERLAY_ICONS.length, columns);
    if (next === null) return;
    e.preventDefault();
    setFocused(next);
    grid.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p id={`${id}-label`} className="text-sm leading-tight text-foreground">
          {label}
        </p>
        {hint && (
          <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div
        ref={gridRef}
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
        }}
        className="grid grid-cols-7 gap-1"
      >
        {OVERLAY_ICONS.map((icon, index) => {
          const checked = icon === value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: the grid implements roving focus and arrow-key radio behavior, like ThemeBrowser.
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={OVERLAY_ICON_LABELS[icon]}
              title={OVERLAY_ICON_LABELS[icon]}
              tabIndex={index === tabStop ? 0 : -1}
              onFocus={() => setFocused(index)}
              onClick={() => onChange(icon)}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border text-muted-foreground transition-colors pointer-coarse:h-11",
                "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                checked
                  ? "border-link bg-primary/10 text-foreground"
                  : "border-border bg-transparent",
              )}
            >
              {icon === "none" ? (
                <span aria-hidden className="font-mono text-2xs tracking-label uppercase">
                  None
                </span>
              ) : (
                <OverlayIcon icon={icon} size="18px" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
