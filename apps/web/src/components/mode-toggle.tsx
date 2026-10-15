"use client";

// Light/dark switch in the site header, backed by next-themes.

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Sun / switch / moon toggle. Flipping it sets an explicit "light" or "dark" theme, replacing
 * any "system" preference.
 */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Mounted-state pattern: next-themes can't know the theme during SSR, so render a neutral,
  // disabled, controlled placeholder until mount to keep the server and client markup equal.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Sun className="h-4 w-4 text-muted-foreground" />
        <Switch size="sm" checked={false} disabled aria-label="Toggle dark mode" />
        <Moon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun className={cn("h-4 w-4", isDark ? "text-muted-foreground" : "text-foreground")} />
      <Switch
        size="sm"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Toggle dark mode"
      />
      <Moon className={cn("h-4 w-4", isDark ? "text-foreground" : "text-muted-foreground")} />
    </div>
  );
}
