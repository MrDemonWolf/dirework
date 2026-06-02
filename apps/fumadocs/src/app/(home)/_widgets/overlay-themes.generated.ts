/*
 * Dirework Design System — GENERATED FILE. Do not edit by hand.
 * Source: design-system/tokens.json
 * Run `bun run tokens` to regenerate.
 */

export const OVERLAY_THEMES = {
  "Default": {
    "bg": "#1C1C1E",
    "accent": "#34C759",
    "text": "#FFFFFF",
    "username": "#BF5AF2"
  },
  "Liquid Glass": {
    "bg": "#E8ECF0",
    "accent": "#007AFF",
    "text": "#000000",
    "username": "#007AFF"
  },
  "Liquid Glass Dark": {
    "bg": "#1C1C1E",
    "accent": "#0A84FF",
    "text": "#F5F5F7",
    "username": "#0A84FF"
  },
  "Neon Cyberpunk": {
    "bg": "#0D0221",
    "accent": "#00FF9F",
    "text": "#00FF9F",
    "username": "#FF006E"
  },
  "Cozy Cottage": {
    "bg": "#FAF3E8",
    "accent": "#B8860B",
    "text": "#5C3D1A",
    "username": "#B8860B"
  },
  "Ocean Depths": {
    "bg": "#0A1628",
    "accent": "#2DD4BF",
    "text": "#E0F2FE",
    "username": "#2DD4BF"
  },
  "Sakura": {
    "bg": "#FFF0F5",
    "accent": "#EC4899",
    "text": "#9D174D",
    "username": "#EC4899"
  },
  "Retro Terminal": {
    "bg": "#050505",
    "accent": "#33FF33",
    "text": "#33FF33",
    "username": "#66FF66"
  },
  "Minimal Light": {
    "bg": "#FFFFFF",
    "accent": "#6366F1",
    "text": "#111827",
    "username": "#6366F1"
  },
  "Sunset": {
    "bg": "#1A0A2E",
    "accent": "#FF6B35",
    "text": "#FBBF24",
    "username": "#FF6B35"
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

export const OVERLAY_THEME_NAMES = ["Default","Liquid Glass","Liquid Glass Dark","Neon Cyberpunk","Cozy Cottage","Ocean Depths","Sakura","Retro Terminal","Minimal Light","Sunset","Twitch Purple"] as OverlayThemeName[];

export const DEFAULT_OVERLAY_THEME: OverlayThemeName = "Default";

export const SQUIRCLE_RADIUS = 0.22;
