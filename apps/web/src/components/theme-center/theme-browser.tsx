"use client";

import { useEffect, useRef, useState } from "react";

import type { ThemePreset } from "@/lib/config-types";
import { themePresets } from "@/lib/theme-presets";
import { nextGridIndex } from "@/lib/grid-navigation";
import { ThemeCard } from "./theme-card";

/**
 * Preset gallery: a responsive grid (2 / 3 / 6 columns) with radiogroup semantics
 * (audit L13) — roving tabindex, Left/Right step through the presets, Up/Down move a row,
 * Home/End jump to the ends. Arrow keys move focus ONLY — Enter/Space/click applies, so
 * browsing presets never mutates the working styles.
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
    const container = containerRef.current;
    if (!container) return;
    // The column count is whatever the breakpoint drew, read from the live grid.
    const columns = getComputedStyle(container).gridTemplateColumns.split(" ").length || 1;
    const next = nextGridIndex(e.key, focusedIndex, themePresets.length, columns);
    if (next === null) return;

    e.preventDefault();
    setFocusedIndex(next);
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Theme presets"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
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
  );
}
