/*
 * Dirework Design System — GENERATED FILE. Do not edit by hand.
 * Source: design-system/tokens.json
 * Run `bun run tokens` to regenerate.
 */

export const OVERLAY_THEMES = {
  Default: {
    bg: "#091533",
    accent: "#00ACED",
    text: "#FFFFFF",
    username: "#A8BCFF",
  },
  "Ocean Depths": {
    bg: "#0A1628",
    accent: "#2DD4BF",
    text: "#E0F2FE",
    username: "#40DCC8",
  },
  "Liquid Glass Dark": {
    bg: "#1C1C1E",
    accent: "#0A84FF",
    text: "#F5F5F7",
    username: "#A0CDFF",
  },
  "Cozy Cottage": {
    bg: "#FAF3E8",
    accent: "#B8860B",
    text: "#4A3015",
    username: "#6E4800",
  },
  "Minimal Light": {
    bg: "#FFFFFF",
    accent: "#6366F1",
    text: "#111827",
    username: "#3F37C9",
  },
  "Twitch Purple": {
    bg: "#0E0E10",
    accent: "#9146FF",
    text: "#EFEFF1",
    username: "#C7A2FF",
  },
} as const;

export type OverlayThemeName = keyof typeof OVERLAY_THEMES;
export type OverlayTheme = (typeof OVERLAY_THEMES)[OverlayThemeName];

export const OVERLAY_THEME_NAMES = [
  "Default",
  "Ocean Depths",
  "Liquid Glass Dark",
  "Cozy Cottage",
  "Minimal Light",
  "Twitch Purple",
] as OverlayThemeName[];

export const DEFAULT_OVERLAY_THEME: OverlayThemeName = "Default";
