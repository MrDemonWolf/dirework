import { createElement, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_TASK_STYLES, DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";

import { TaskStyleEditor } from "@/components/theme-center/task-style-editor";
import { TimerStyleEditor } from "@/components/theme-center/timer-style-editor";

/**
 * The Theme Center's style editors, rendered for real, with each color row's `onChange`
 * captured (Colors is the section open on load). A row's edit must apply to the draft as
 * React holds it when the update runs, not to the copy the row was rendered with. That is
 * what lets every unchanged row keep its cached element when another row changes, and it
 * means two edits React batches into one render both land.
 */

const rowSetters = vi.hoisted(() => new Map<string, (value: string) => void>());

vi.mock("@/components/theme-center/color-input", () => ({
  ColorInput: ({ id, onChange }: { id: string; onChange: (value: string) => void }) => {
    rowSetters.set(id, onChange);
    return null;
  },
}));

type StyleEditor<T> = (props: { styles: T; onChange: Dispatch<SetStateAction<T>> }) => ReactNode;

/**
 * Renders `Editor` once over `styles`, then edits two of its color rows before it renders
 * again, the way React batches two updates: each one runs on the result of the one before,
 * as the page's `useState` setter does. Returns the draft after both.
 */
function editTwoRows<T>(
  Editor: StyleEditor<T>,
  styles: T,
  idPrefix: string,
  edits: [path: string, value: string][],
): T {
  let draft = styles;
  const setDraft: Dispatch<SetStateAction<T>> = (action) => {
    draft = typeof action === "function" ? (action as (prev: T) => T)(draft) : action;
  };
  rowSetters.clear();
  renderToStaticMarkup(createElement(Editor, { styles, onChange: setDraft }));
  for (const [path, value] of edits) {
    const set = rowSetters.get(`${idPrefix}-${path.replaceAll(".", "-")}`);
    if (!set) throw new Error(`no color row rendered for ${path}`);
    set(value);
  }
  return draft;
}

describe("style editor rows", () => {
  it("keeps both of two timer edits made before the editor re-renders", () => {
    const next = editTwoRows(TimerStyleEditor, DEFAULT_TIMER_STYLES, "timer-style", [
      ["ring.fillColor", "#111111"],
      ["text.color", "#222222"],
    ]);
    expect(next.ring.fillColor).toBe("#111111");
    expect(next.text.color).toBe("#222222");
  });

  it("keeps both of two task-list edits made before the editor re-renders", () => {
    const next = editTwoRows(TaskStyleEditor, DEFAULT_TASK_STYLES, "task-style", [
      ["header.fontColor", "#111111"],
      ["task.fontColor", "#222222"],
    ]);
    expect(next.header.fontColor).toBe("#111111");
    expect(next.task.fontColor).toBe("#222222");
  });
});
