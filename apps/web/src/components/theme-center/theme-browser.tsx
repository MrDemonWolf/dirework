"use client";

import { useRef } from "react";

import type { ThemePreset } from "@/lib/config-types";
import { themePresets } from "@/lib/theme-presets";
import { ThemeCard } from "./theme-card";

/**
 * Horizontal preset rail with radiogroup semantics (audit L13):
 * roving tabindex + arrow-key navigation across the swatches.
 */
export function ThemeBrowser({
  activeThemeId,
  onApply,
}: {
  activeThemeId: string | null;
  onApply: (theme: ThemePreset) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: the checked card (or the first) is the tab stop
  const focusIndex = Math.max(
    0,
    themePresets.findIndex((t) => t.id === activeThemeId),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -1;
    else return;

    e.preventDefault();
    const currentIndex = themePresets.findIndex((t) => t.id === activeThemeId);
    const from = currentIndex === -1 ? 0 : currentIndex;
    const next = (from + delta + themePresets.length) % themePresets.length;
    onApply(themePresets[next]!);
    const radios = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Theme presets"
      onKeyDown={handleKeyDown}
      className="flex gap-3 overflow-x-auto p-1 pb-2"
    >
      {themePresets.map((theme, i) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isActive={activeThemeId === theme.id}
          onApply={() => onApply(theme)}
          tabIndex={i === focusIndex ? 0 : -1}
        />
      ))}
    </div>
  );
}
