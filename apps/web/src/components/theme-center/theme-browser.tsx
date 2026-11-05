"use client";

import type { ThemePreset } from "@/lib/config-types";
import { themePresets } from "@/lib/theme-presets";
import { useRovingGrid } from "@/lib/use-roving-grid";
import { ThemeCard } from "./theme-card";

/**
 * Preset gallery: a responsive grid (2 / 3 / 6 columns) with radiogroup semantics
 * (audit L13) and a roving tabindex (`useRovingGrid`, shared with the icon pickers):
 * Left/Right step through the presets, Up/Down move a row, Home/End jump to the ends, and
 * Tab enters on the checked preset. Arrow keys move focus ONLY — Enter/Space/click applies,
 * so browsing presets never mutates the working styles.
 */
export function ThemeBrowser({
  activeThemeId,
  onApply,
}: {
  activeThemeId: string | null;
  onApply: (theme: ThemePreset) => void;
}) {
  const { gridRef, tabStop, onKeyDown, onBlur, onItemFocus } = useRovingGrid({
    count: themePresets.length,
    selectedIndex: themePresets.findIndex((t) => t.id === activeThemeId),
  });

  return (
    <div
      ref={gridRef}
      role="radiogroup"
      aria-label="Theme presets"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      {themePresets.map((theme, i) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isActive={activeThemeId === theme.id}
          onApply={() => onApply(theme)}
          onFocus={() => onItemFocus(i)}
          tabIndex={i === tabStop ? 0 : -1}
        />
      ))}
    </div>
  );
}
