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

  // Mounted-state pattern: next-themes can't know the theme during SSR, so render a static
  // lookalike until mount to keep the server and client markup equal. It is driven by the
  // `dark` class the <head> script (lib/theme-init.ts) sets before paint and has the same
  // geometry and colours as Switch size="sm", so the mounted Switch replaces it without a
  // visible flip.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2" role="img" aria-label="Toggle dark mode">
        <Sun className="h-4 w-4 text-foreground dark:text-muted-foreground" />
        <span
          aria-hidden
          className="relative inline-flex h-[14px] w-[24px] shrink-0 items-center rounded-full border border-transparent bg-muted-foreground/70 dark:bg-primary"
        >
          <span className="block size-3 translate-x-0 rounded-full bg-background dark:translate-x-[calc(100%-2px)] dark:bg-primary-foreground" />
        </span>
        <Moon className="h-4 w-4 text-muted-foreground dark:text-foreground" />
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
