// Arrow-key movement through a wrapping grid of items (the Theme Center preset gallery).

/**
 * The index focus moves to for `key`, or null when the key doesn't navigate.
 * Left/Right step one item and wrap around the ends; Up/Down move one row and stay put at
 * the top or bottom edge (a short last row clamps to its last item); Home/End jump to the
 * first and last item.
 */
export function nextGridIndex(
  key: string,
  index: number,
  count: number,
  columns: number,
): number | null {
  if (count <= 0) return null;
  const cols = Math.max(1, Math.floor(columns));
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "ArrowDown": {
      if (index + cols < count) return index + cols;
      const lastRow = Math.floor((count - 1) / cols);
      return Math.floor(index / cols) < lastRow ? count - 1 : index;
    }
    case "ArrowUp":
      return index - cols >= 0 ? index - cols : index;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
