// Source pins for the Task Board's render boundaries (components/task-manager.tsx). The add
// field's draft lives in AddTaskForm, never in TaskManager: there, each keystroke re-rendered
// the whole board, every row with its tooltips and ⋯ menu (about 6 ms at 40 rows and 31 ms at
// the 250-row cap on a fast machine, 4x that on a throttled CPU). The board keeps the input's
// ref, which its empty state and its focus restore still use.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(import.meta.dirname, "../../components/task-manager.tsx"),
  "utf8",
);

/** A top-level component's source: its declaration up to the first closing brace at column 0. */
function component(name: string): string {
  const body = new RegExp(`^(?:export )?function ${name}\\([\\s\\S]*?^}$`, "m").exec(source)?.[0];
  expect(body, `function ${name} in task-manager.tsx`).toBeDefined();
  return body ?? "";
}

describe("task board structure", () => {
  it("keeps the add field's draft, the create mutation and the form out of TaskManager", () => {
    const addField = component("TaskManager").match(
      /useState(?:<string>)?\(""\)|\b(?:newTask|setNewTask)\b|trpc\.task\.create|<form\b|<Input\b/g,
    );
    expect(addField ?? [], "add-field state or markup in TaskManager").toEqual([]);
  });

  it("renders AddTaskForm once, passing only the board's add-input ref", () => {
    // A stable ref and nothing else: a board render (a poll, a row action) hands the form
    // no new props, so the compiler keeps the element and the form doesn't re-render.
    const forms = component("TaskManager").match(/<AddTaskForm inputRef=\{addInputRef\} \/>/g);
    expect(forms ?? [], "<AddTaskForm inputRef={addInputRef} /> in TaskManager").toHaveLength(1);
  });

  it("gives AddTaskForm the draft, the create mutation and the submit", () => {
    const form = component("AddTaskForm");
    expect(form).toContain('useState("")');
    expect(form).toContain("...trpc.task.create.mutationOptions(),");
    expect(form).toContain("<form onSubmit={handleSubmit}");
    expect(form).toMatch(/<Input\s+ref=\{inputRef\}/);
  });

  it("still focuses the add input from the empty board and after the list empties", () => {
    const board = component("TaskManager");
    expect(board).toContain("const addInputRef = useRef<HTMLInputElement>(null);");
    expect(board).toContain("onClick={focusAddInput}");
    expect(board).toContain("(target ?? addInputRef.current)?.focus();");
  });
});
