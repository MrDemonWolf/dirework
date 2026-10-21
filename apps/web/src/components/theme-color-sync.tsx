"use client";

// Keeps <meta name="theme-color"> on the app's own theme, not the OS's. Mounted by the
// (app) layout only; overlays and the bot console don't need a tinted browser bar.

import { useAppTheme } from "@/components/theme-provider";
import { useEffect } from "react";

import { themeColorFor } from "@/lib/theme-color";

/** Renders nothing; rewrites every theme-color tag whenever the resolved theme changes. */
export function ThemeColorSync() {
  const { resolvedTheme } = useAppTheme();

  useEffect(() => {
    const color = themeColorFor(resolvedTheme);
    if (!color) return;
    // Both media-keyed tags get the same colour, so whichever one the browser picks for
    // the OS scheme shows the app's theme.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = color;
    }
  }, [resolvedTheme]);

  return null;
}
