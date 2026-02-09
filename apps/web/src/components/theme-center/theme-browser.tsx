"use client";

import type { ThemePreset } from "@/lib/config-types";
import { themePresets } from "@/lib/theme-presets";
import { ThemeCard } from "./theme-card";

export function ThemeBrowser({
  activeThemeId,
  onApply,
}: {
  activeThemeId: string | null;
  onApply: (theme: ThemePreset) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {themePresets.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isActive={activeThemeId === theme.id}
          onApply={() => onApply(theme)}
        />
      ))}
    </div>
  );
}
