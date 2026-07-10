/*
 * Dirework Design System — GENERATED FILE. Do not edit by hand.
 * Source: design-system/tokens.json
 * Run `bun run tokens` to regenerate.
 */

export const OVERLAY_THEMES = {
  "Default": {
    "bg": "#091533",
    "accent": "#00ACED",
    "text": "#FFFFFF",
    "username": "#6B8BF5"
  },
  "Ocean Depths": {
    "bg": "#0A1628",
    "accent": "#2DD4BF",
    "text": "#E0F2FE",
    "username": "#2DD4BF"
  },
  "Liquid Glass Dark": {
    "bg": "#1C1C1E",
    "accent": "#0A84FF",
    "text": "#F5F5F7",
    "username": "#0A84FF"
  },
  "Cozy Cottage": {
    "bg": "#FAF3E8",
    "accent": "#B8860B",
    "text": "#5C3D1A",
    "username": "#B8860B"
  },
  "Minimal Light": {
    "bg": "#FFFFFF",
    "accent": "#6366F1",
    "text": "#111827",
    "username": "#6366F1"
  },
  "Twitch Purple": {
    "bg": "#0E0E10",
    "accent": "#9146FF",
    "text": "#EFEFF1",
    "username": "#BF94FF"
  }
} as const;

export type OverlayThemeName = keyof typeof OVERLAY_THEMES;
export type OverlayTheme = (typeof OVERLAY_THEMES)[OverlayThemeName];

export const OVERLAY_THEME_NAMES = ["Default","Ocean Depths","Liquid Glass Dark","Cozy Cottage","Minimal Light","Twitch Purple"] as OverlayThemeName[];

export const DEFAULT_OVERLAY_THEME: OverlayThemeName = "Default";
