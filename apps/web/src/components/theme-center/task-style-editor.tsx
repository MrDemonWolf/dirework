"use client";

// Theme Center editor for the task-list overlay's styles (the "Task style" tab of
// /dashboard/styles).

import type { Dispatch, SetStateAction } from "react";

import type { TaskStylesConfig } from "@/lib/config-types";
import { TASK_STYLE_FIELDS } from "@/lib/style-sections";
import { defaultTaskStyles } from "@/lib/theme-presets";
import { StyleSectionsEditor } from "./style-sections-editor";

/**
 * Controlled form over `TaskStylesConfig`, which the Styles page holds as unsaved working
 * state (driving the live preview) until the owner saves. `onChange` is that state's
 * setter: every edit is an updater on the current draft. Rows come from `TASK_STYLE_FIELDS`.
 */
export function TaskStyleEditor({
  styles,
  onChange,
}: {
  styles: TaskStylesConfig;
  onChange: Dispatch<SetStateAction<TaskStylesConfig>>;
}) {
  return (
    <StyleSectionsEditor
      styles={styles}
      onChange={onChange}
      fields={TASK_STYLE_FIELDS}
      defaults={defaultTaskStyles}
      idPrefix="task-style"
      overlayName="task list"
    />
  );
}
