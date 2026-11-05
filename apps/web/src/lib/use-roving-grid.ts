"use client";

// Roving tabindex for a radiogroup laid out as a CSS grid: the Theme Center's preset gallery
// (ThemeBrowser) and its icon pickers (IconPickerRow). The key-to-index math is
// grid-navigation.ts; this is the focus glue around it.

import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";

import { nextGridIndex } from "@/lib/grid-navigation";

/**
 * The item that holds the group's one tab stop: the focused item while focus is inside the
 * group, else the checked one, else the first. So Tab and Shift+Tab enter on the checked
 * radio, wherever the arrow keys last left focus (the WAI-ARIA radio group pattern).
 */
export function rovingTabStop(focused: number | null, selectedIndex: number): number {
  return focused ?? Math.max(0, selectedIndex);
}

/**
 * How many columns a grid's computed `grid-template-columns` lists ("120px 120px 120px" is
 * 3), so Up/Down move one row of whatever the breakpoint drew. Never less than 1.
 */
export function gridColumnCount(template: string): number {
  return Math.max(1, template.split(" ").filter(Boolean).length);
}

/**
 * Roving tabindex over `count` `role="radio"` items in a CSS grid, the checked one at
 * `selectedIndex` (-1 for none). Arrow keys move focus only: Left/Right wrap, Up/Down move a
 * row, Home/End jump. Picking stays with the caller's click, Enter and Space. Put `gridRef`,
 * `onKeyDown` and `onBlur` on the radiogroup; give item `i` `tabIndex={i === tabStop ? 0 : -1}`
 * and `onFocus={() => onItemFocus(i)}`.
 */
export function useRovingGrid({ count, selectedIndex }: { count: number; selectedIndex: number }) {
  const gridRef = useRef<HTMLDivElement>(null);
  // The item focus is on while it is inside the group; null once focus leaves the group.
  const [focused, setFocused] = useState<number | null>(null);
  const tabStop = rovingTabStop(focused, selectedIndex);

  const onKeyDown = (e: KeyboardEvent) => {
    const grid = gridRef.current;
    if (!grid) return;
    // The column count is whatever the breakpoint drew, read from the live grid.
    const columns = gridColumnCount(getComputedStyle(grid).gridTemplateColumns);
    const next = nextGridIndex(e.key, tabStop, count, columns);
    if (next === null) return;
    e.preventDefault();
    setFocused(next);
    grid.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  // Focus leaving the group, not moving between its items, hands the tab stop back to the
  // checked item.
  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
  };

  const onItemFocus = (index: number) => setFocused(index);

  return { gridRef, tabStop, onKeyDown, onBlur, onItemFocus };
}
