"use client";

import { useEffect, useRef, useState } from "react";

import type { ThemePreset } from "@/lib/config-types";
import { themePresets } from "@/lib/theme-presets";
import { ThemeCard } from "./theme-card";

/**
 * Horizontal preset rail with radiogroup semantics (audit L13):
 * roving tabindex + arrow-key navigation across the swatches.
 * Arrow keys move focus ONLY — Enter/Space/click applies, so browsing
 * presets never mutates the working styles.
 */
export function ThemeBrowser({
  activeThemeId,
  onApply,
}: {
  activeThemeId: string | null;
  onApply: (theme: ThemePreset) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: the focused card (initially the checked one) is the tab stop
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      themePresets.findIndex((t) => t.id === activeThemeId),
    ),
  );

  // Config loads async — re-sync the tab stop when the active theme resolves
  // or changes so keyboard entry lands on the checked swatch.
  useEffect(() => {
    const index = themePresets.findIndex((t) => t.id === activeThemeId);
    if (index >= 0) setFocusedIndex(index);
  }, [activeThemeId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -1;
    else return;

    e.preventDefault();
    const next = (focusedIndex + delta + themePresets.length) % themePresets.length;
    setFocusedIndex(next);
    const radios = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[next]?.focus();
  };

  return (
    <div className="relative">
      {/* Edge fades — signal the rail scrolls past the viewport */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent"
      />
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Theme presets"
        onKeyDown={handleKeyDown}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 pb-2"
      >
        {themePresets.map((theme, i) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={activeThemeId === theme.id}
            onApply={() => onApply(theme)}
            onFocus={() => setFocusedIndex(i)}
            tabIndex={i === focusedIndex ? 0 : -1}
          />
        ))}
      </div>
    </div>
  );
}
