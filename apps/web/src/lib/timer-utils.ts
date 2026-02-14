export function toHexOpacity(opacity: number): string {
  return Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
}

export function formatTime(
  ms: number,
  showHours: boolean,
): { hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(showHours ? minutes : Math.floor(totalSeconds / 60)).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

/**
 * Build a rounded-rectangle SVG path starting from top-center, going clockwise.
 * This gives us a continuous path we can use with strokeDasharray for progress.
 */
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  r = Math.min(r, w / 2, h / 2);
  // Start at top-center, draw clockwise
  return [
    `M ${x + w / 2} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}
