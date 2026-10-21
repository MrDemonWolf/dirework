// Browser/status-bar tint for the app's resolved theme. The root layout's `viewport` emits
// two <meta name="theme-color"> tags keyed on prefers-color-scheme as the SSR fallback; once
// next-themes knows the app's own theme (which can differ from the OS), ThemeColorSync
// rewrites them with this colour.

import { DARK_BACKGROUND_HEX, LIGHT_BACKGROUND_HEX } from "@/app/manifest";

/**
 * The theme-color for a next-themes `resolvedTheme`: dark gets the dark background, any
 * other resolved value (light, or a stale custom class that leaves the light palette)
 * gets the light one. `undefined` (not mounted yet) returns null: leave the tags alone.
 */
export function themeColorFor(resolvedTheme: string | undefined): string | null {
  if (resolvedTheme === undefined) return null;
  return resolvedTheme === "dark" ? DARK_BACKGROUND_HEX : LIGHT_BACKGROUND_HEX;
}
