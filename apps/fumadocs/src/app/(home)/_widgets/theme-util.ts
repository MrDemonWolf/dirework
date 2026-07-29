/** hex (#rgb or #rrggbb) → rgba() string. Lets the overlay widgets tint a
 *  theme's bg/text/accent at any opacity for tracks, task rows, muted text. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Viewer-name colors that clear WCAG AA on the given theme background —
 *  bright Twitch-style hues on dark themes, deepened variants on light. */
export function authorPalette(themeBg: string): [string, string, string] {
  return relativeLuminance(themeBg) > 0.4
    ? ["#7c3aed", "#15803d", "#1d4ed8"] // AA on light panels
    : ["#bf5af2", "#34c759", "#0a84ff"]; // AA on dark panels
}
